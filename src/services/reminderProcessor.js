// src/services/reminderProcessor.js
import * as Sentry from '@sentry/node'

/**
 * Main execution function to process all reminders and nudges.
 * Can be called automatically via cron or manually via an API controller.
 */
export async function runReminderProcessor(strapi) {
  strapi.log.info('Starting reminder and nudge processing job...')

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day for accurate date comparison

    // 1. Process Monthly Reminders
    await processMonthlyReminders(strapi, today)

    // 2. Process Daily Take Reminders
    await processDailyTakeReminders(strapi, today)

    // 3. Process Goal Review Reminders
    await processGoalReminders(strapi, today)

    // 4. Process Init Nudge Messages (2 weeks up to 18 months)
    await processInitNudges(strapi, today)

    strapi.log.info('Reminder and nudge processing job completed successfully.')
  } catch (error) {
    strapi.log.error('Critical error in reminder processor:', error)
    // Send error log to Sentry
    Sentry.captureException(error)
  }
}

/**
 * Helper: Send Email using Strapi's built-in email plugin
 */
async function sendEmail(strapi, toEmail, subject, htmlContent) {
  try {
    if (!toEmail) throw new Error('Missing destination email address.')
    
    await strapi.plugin('email').service('email').send({
      to: toEmail,
      subject: subject,
      html: htmlContent,
    })
    strapi.log.info(`Email successfully sent to ${toEmail}`)
  } catch (error) {
    strapi.log.error(`Failed to send email to ${toEmail}:`, error)
    Sentry.captureException(error)
  }
}

/**
 * Helper: Send SMS using Firetext API
 */
async function sendSMS(strapi, toNumber, messageContent) {
  try {
    if (!toNumber) throw new Error('Missing destination phone number.')

    const params = new URLSearchParams({
      username: process.env.FIRETEXT_USERNAME,
      password: process.env.FIRETEXT_PASSWORD,
      to: toNumber,
      from: 'HealthDiary',
      message: messageContent,
    })

    const response = await fetch(`https://www.firetext.co.uk/api/sendsms?${params.toString()}`)
    const result = await response.text()

    if (!result.includes('Success')) {
      throw new Error(`Firetext API error response: ${result}`)
    }

    strapi.log.info(`Firetext SMS successfully sent to ${toNumber}`)
  } catch (error) {
    strapi.log.error(`Failed to send SMS to ${toNumber}:`, error)
    Sentry.captureException(error)
  }
}

/**
 * Helper: Format message templates by replacing placeholders
 */
function formatMessageContent(templateString, user, extraData = {}) {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  let content = templateString.replace(/{fullname}/g, fullName)

  if (extraData.shorttype !== undefined) {
    content = content.replace(/{shorttype}/g, extraData.shorttype)
  }
  if (extraData.longtype !== undefined) {
    content = content.replace(/{longtype}/g, extraData.longtype)
  }

  return content
}

/**
 * 1. Monthly Reminders Handler
 */
async function processMonthlyReminders(strapi, today) {
  const reminders = await strapi.documents('api::reminder.reminder').findMany({
    populate: ['user'],
  })

  // Fetch all message templates to match by type
  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  for (const reminder of reminders) {
    try {
      const user = reminder.user
      const recipient = reminder.to || user?.email || user?.phone
      if (!recipient) continue

      // Determine baseline date: lastSent or start
      const baselineDateStr = reminder.lastSent || reminder.start
      if (!baselineDateStr) continue

      const baselineDate = new Date(baselineDateStr)
      
      // Frequency map: 'one' = 1 month, 'two' = 2 months, 'three' = 3 months
      const freqMonths = reminder.frequency === 'three' ? 3 : reminder.frequency === 'two' ? 2 : 1

      // Calculate target next due date by adding frequency months to baseline
      const dueDate = new Date(baselineDate)
      dueDate.setMonth(dueDate.getMonth() + freqMonths)
      dueDate.setHours(0, 0, 0, 0)

      // Check if due today or past due
      if (today >= dueDate) {
        const msgTemplate = messageMap.get(reminder.type)
        if (!msgTemplate) {
          strapi.log.warn(`No message template found for reminder type: ${reminder.type}`)
          continue
        }

        const formattedHtml = formatMessageContent(msgTemplate.html || '', user)
        const formattedSubject = formatMessageContent(msgTemplate.subject || 'Reminder', user)

        if (reminder.method === 'email') {
          await sendEmail(strapi, recipient, formattedSubject, formattedHtml)
        } else {
          // Fallback plain text representation for SMS if html isn't stripped
          const plainText = msgTemplate.plain || formattedHtml.replace(/<[^>]*>?/gm, '')
          await sendSMS(strapi, recipient, plainText)
        }

        // Update lastSent to today
        await strapi.documents('api::reminder.reminder').update({
          documentId: reminder.documentId,
          data: { lastSent: today.toISOString().split('T')[0] },
        })
      }
    } catch (err) {
      strapi.log.error(`Error processing monthly reminder ID ${reminder.id}:`, err)
      Sentry.captureException(err)
    }
  }
}

/**
 * 2. Daily Take Reminders Handler
 */
async function processDailyTakeReminders(strapi, today) {
  const reminders = await strapi.documents('api::reminder.reminder').findMany({
    filters: { type: 'take' },
    populate: ['user'],
  })

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  for (const reminder of reminders) {
    try {
      const user = reminder.user
      const recipient = reminder.to || user?.email || user?.phone
      if (!recipient) continue

      // Check if already sent today
      if (reminder.lastSent === today.toISOString().split('T')[0]) continue

      const msgTemplate = messageMap.get('take')
      if (!msgTemplate) continue

      const formattedHtml = formatMessageContent(msgTemplate.html || '', user)
      const formattedSubject = formatMessageContent(msgTemplate.subject || 'Daily Take Reminder', user)

      if (reminder.method === 'email') {
        await sendEmail(strapi, recipient, formattedSubject, formattedHtml)
      } else {
        const plainText = msgTemplate.plain || formattedHtml.replace(/<[^>]*>?/gm, '')
        await sendSMS(strapi, recipient, plainText)
      }

      await strapi.documents('api::reminder.reminder').update({
        documentId: reminder.documentId,
        data: { lastSent: today.toISOString().split('T')[0] },
      })
    } catch (err) {
      strapi.log.error(`Error processing take reminder ID ${reminder.id}:`, err)
      Sentry.captureException(err)
    }
  }
}

/**
 * 3. Goal Review Reminders Handler
 */
async function processGoalReminders(strapi, today) {
  const todayStr = today.toISOString().split('T')[0]
  
  // Find goals where reviewDate is today
  const goals = await strapi.documents('api::goal.goal').findMany({
    filters: { reviewDate: todayStr },
    populate: ['user'],
  })

  const messages = await strapi.documents('api::message.message').findMany()
  const goalMsgTemplate = messages.find((m) => m.type === 'goal_reminder')

  if (!goalMsgTemplate) {
    strapi.log.warn('Message template of type "goal_reminder" not found.')
    return
  }

  for (const goal of goals) {
    try {
      const user = goal.user
      if (!user) continue

      // Check user contact preference (sms or email - default to email if blank)
      const preference = user.contact_preference || 'email'
      const recipient = user.email || user.phone
      if (!recipient) continue

      const shortType = goal.goaltype || 'goal'
      const longType = shortType.toLowerCase() === 'activity' ? 'being active' : 'eating healthily'

      const formattedHtml = formatMessageContent(goalMsgTemplate.html || '', user, {
        shorttype: shortType,
        longtype: longType,
      })
      const formattedSubject = formatMessageContent(goalMsgTemplate.subject || 'Goal Review', user)

      if (preference === 'sms' && user.phone) {
        const plainText = goalMsgTemplate.plain || formattedHtml.replace(/<[^>]*>?/gm, '')
        await sendSMS(strapi, user.phone, plainText)
      } else {
        await sendEmail(strapi, user.email || recipient, formattedSubject, formattedHtml)
      }
    } catch (err) {
      strapi.log.error(`Error processing goal review for goal ID ${goal.id}:`, err)
      Sentry.captureException(err)
    }
  }
}

/**
 * 4. Weekly and Monthly Nudge Messages Handler (Based on user init date)
 */
async function processInitNudges(strapi, today) {
  const users = await strapi.documents('plugin::users-permissions.user').findMany()
  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  for (const user of users) {
    try {
      if (!user.init || !user.email) continue

      const initDate = new Date(user.init)
      initDate.setHours(0, 0, 0, 0)

      // Calculate time differences in days and months
      const diffTime = Math.abs(today - initDate)
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      let targetType = null

      // Check for exact matching triggers
      if (diffDays === 14) {
        targetType = '2_week'
      } else {
        // Calculate exact month differences
        const monthDiff = (today.getFullYear() - initDate.getFullYear()) * 12 + (today.getMonth() - initDate.getMonth())
        const dayOfMonthMatch = today.getDate() === initDate.getDate()

        if (dayOfMonthMatch && monthDiff >= 1 && monthDiff <= 18) {
          if (monthDiff === 1) targetType = '1_month'
          else if (monthDiff === 2) targetType = '2_month'
          else targetType = `${monthDiff}_month` // e.g., '3_month', '4_month' up to '18_month'
        }
      }

      if (targetType) {
        const msgTemplate = messageMap.get(targetType)
        if (!msgTemplate) {
          // If a specific monthly template doesn't exist, skip safely
          continue
        }

        const formattedHtml = formatMessageContent(msgTemplate.html || '', user)
        const formattedSubject = formatMessageContent(msgTemplate.subject || 'Nudge Update', user)

        // Nudges are sent out by email periodically
        await sendEmail(strapi, user.email, formattedSubject, formattedHtml)
      }
    } catch (err) {
      strapi.log.error(`Error processing init nudge for user ID ${user.id}:`, err)
      Sentry.captureException(err)
    }
  }
}