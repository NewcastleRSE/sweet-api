import fs from 'fs/promises'
import path from 'path'
import * as Sentry from '@sentry/node'

/**
 * Main production-ready reminder and nudge processor.
 */
export async function runReminderProcessor(customStrapi = null) {
  const activeStrapi = customStrapi || global.strapi

  if (!activeStrapi) {
    console.error('Strapi instance is not available in reminderProcessor.')
    return
  }

  const sendMessages = process.env.SEND_MESSAGES === 'true'
  const testUserDocId = process.env.TEST_USER_DOCUMENT_ID
  const capturedDispatches = []

  if (!sendMessages) {
    activeStrapi.log.info('[REMINDER PROCESSOR] Running in SIMULATION mode (SEND_MESSAGES=false). Dispatches will be written to JSON.')
  } else {
    activeStrapi.log.info('[REMINDER PROCESSOR] Running in LIVE production mode (SEND_MESSAGES=true).')
  }

  if (testUserDocId) {
    activeStrapi.log.info(`[TEST SCOPE] Scoped strictly to Test User Document ID: ${testUserDocId}`)
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const context = {
      strapi: activeStrapi,
      today,
      testUserDocId,
      sendMessages,
      capturedDispatches,
    }

    await processMonthlyReminders(context)
    await processDailyTakeReminders(context)
    await processGoalReminders(context)
    await processInitNudges(context)

    // Write to JSON only if simulation mode is active
    if (!sendMessages) {
      const outputPath = path.join(process.cwd(), 'all_test_dispatches.json')
      await fs.writeFile(outputPath, JSON.stringify(capturedDispatches, null, 2), 'utf-8')
      activeStrapi.log.info(`[JOB COMPLETE] Simulation complete. Wrote ${capturedDispatches.length} scheduled scenarios to ${outputPath}`)
    } else {
      activeStrapi.log.info(`[JOB COMPLETE] Live reminder check finished. Processed for active schedule window.`)
    }

  } catch (error) {
    activeStrapi.log.error('Critical error in reminder processor main execution:', error)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(error, { extra: { context: 'runReminderProcessor main catch' } })
    }
  }
}

/**
 * Helper to format date as a readable local string (YYYY-MM-DD HH:mm:ss)
 */
const formatLocalDateTime = (date) => {
  if (!date) return 'Immediate / Today'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Firetext SMS Dispatch Helper
 */
async function sendFiretextSms(strapi, { recipient, message, contextMeta }) {
  const apiKey = process.env.FIRETEXT_API_KEY
  if (!apiKey) {
    const err = new Error('Missing FIRETEXT_API_KEY in environment variables.')
    strapi.log.error(err.message)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(err, { extra: contextMeta })
    }
    return
  }

  try {
    let cleanRecipient = recipient.replace(/\D/g, '')
    if (cleanRecipient.startsWith('0')) {
      cleanRecipient = '44' + cleanRecipient.slice(1)
    }

    const params = new URLSearchParams()
    params.append('apiKey', apiKey)
    params.append('to', cleanRecipient)
    params.append('message', message)
    params.append('from', 'SweetApp')

    const response = await fetch('https://www.firetext.co.uk/api/sendsms', {
      method: 'POST',
      body: params,
    })

    const text = await response.text()
    if (text.includes('Error') || text.includes('failed')) {
      throw new Error(`Firetext API rejected SMS: ${text}`)
    }
  } catch (err) {
    strapi.log.error(`[FIRETEXT ERROR] Failed to send SMS to ${recipient}:`, err)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(err, { extra: contextMeta })
    }
  }
}

/**
 * Centralized Dispatch Controller (Handles Simulation vs Live & Exact Minute Check)
 */
async function dispatchMessage(context, { user, recipient, subject, content, type, channel, scheduledDate }) {
  const { strapi, sendMessages, capturedDispatches } = context

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  const metaContext = {
    messageType: type,
    channel,
    recipient,
    userFullName: fullName,
    userId: user?.documentId || user?.id,
    scheduledSendDate: formatLocalDateTime(scheduledDate),
  }

  // 1. If Simulation Mode, capture to JSON array and return
  if (!sendMessages) {
    capturedDispatches.push({
      timestampGenerated: formatLocalDateTime(new Date()),
      ...metaContext,
      subjectLine: subject || 'N/A',
      messageBody: content,
    })
    return
  }

  // 2. Precise Minute Check for Live Production Mode
  const now = new Date()
  const isDueToday = 
    scheduledDate.getFullYear() === now.getFullYear() &&
    scheduledDate.getMonth() === now.getMonth() &&
    scheduledDate.getDate() === now.getDate()

  const isDueThisMinute = 
    scheduledDate.getHours() === now.getHours() &&
    scheduledDate.getMinutes() === now.getMinutes()

  if (!isDueToday || !isDueThisMinute) {
    return // Not due this exact minute; skip silently
  }

  // 3. Execute Live Dispatch
  try {
    if (channel === 'email') {
      const plainText = content ? content.replace(/<[^>]*>?/gm, '') : ''

      await strapi.plugin('email').service('email').send({
        to: recipient,
        subject: subject,
        text: plainText,
        html: content,
      })
      strapi.log.info(`[LIVE EMAIL SENT] Type: ${type} | To: ${recipient}`)

    } else if (channel === 'sms') {
      const plainText = content ? content.replace(/<[^>]*>?/gm, '') : ''
      await sendFiretextSms(strapi, {
        recipient,
        message: plainText,
        contextMeta: metaContext,
      })
      strapi.log.info(`[LIVE SMS SENT] Type: ${type} | To: ${recipient}`)
    }
  } catch (err) {
    strapi.log.error(`[DISPATCH ERROR] Failed to send live ${channel} for type ${type} to ${recipient}:`, err)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(err, { extra: metaContext })
    }
  }
}

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
async function processMonthlyReminders(context) {
  const { strapi, testUserDocId } = context

  const queryFilters = testUserDocId ? { user: { documentId: testUserDocId } } : {}
  const reminders = await strapi.documents('api::reminder.reminder').findMany({
    filters: queryFilters,
    populate: { user: true },
  })

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  for (const reminder of (reminders || [])) {
    try {
      if (reminder.type === 'take') continue

      const user = reminder.user
      if (!user) continue

      const method = (reminder.method || user.contact_preference || 'email').toLowerCase()
      const channel = method === 'sms' ? 'sms' : 'email'

      let recipient = null
      if (channel === 'sms') {
        recipient = (reminder.to && !reminder.to.includes('@')) ? reminder.to : (user.mobile || user.phone)
      } else {
        recipient = (reminder.to && reminder.to.includes('@')) ? reminder.to : (user.email || user.mobile)
      }

      if (!recipient) continue

      const baselineDateStr = reminder.lastSent || reminder.start
      if (!baselineDateStr) continue

      const baselineDate = new Date(baselineDateStr)
      const freqMonths = reminder.frequency === 'three' ? 3 : reminder.frequency === 'two' ? 2 : 1

      const dueDate = new Date(baselineDate)
      dueDate.setMonth(dueDate.getMonth() + freqMonths)

      const timeStr = reminder.time || '08:00'
      const [hours = '8', minutes = '0'] = timeStr.split(':')
      dueDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

      const msgTemplate = messageMap.get(reminder.type)
      if (!msgTemplate) continue

      const formattedHtml = formatMessageContent(msgTemplate.html || '', user)
      const formattedSubject = formatMessageContent(msgTemplate.subject || 'Reminder', user)
      const plainTemplate = msgTemplate.plain || (msgTemplate.html ? msgTemplate.html.replace(/<[^>]*>?/gm, '') : '')
      const contentToSend = channel === 'email' ? formattedHtml : formatMessageContent(plainTemplate, user)

      await dispatchMessage(context, {
        user,
        recipient,
        subject: formattedSubject,
        content: contentToSend,
        type: `monthly_${reminder.type}`,
        channel,
        scheduledDate: dueDate,
      })
    } catch (err) {
      strapi.log.error(`Error processing monthly reminder ID ${reminder.id}:`, err)
      if (typeof Sentry?.captureException === 'function') {
        Sentry.captureException(err, { extra: { reminderId: reminder.id, type: reminder.type } })
      }
    }
  }
}

/**
 * 2. Daily Take Reminders Handler
 */
async function processDailyTakeReminders(context) {
  const { strapi, today, testUserDocId } = context

  const queryFilters = { type: 'take' }
  if (testUserDocId) {
    queryFilters.user = { documentId: testUserDocId }
  }

  const reminders = await strapi.documents('api::reminder.reminder').findMany({
    filters: queryFilters,
    populate: { user: true },
  })

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  for (const reminder of (reminders || [])) {
    try {
      const user = reminder.user
      if (!user) continue

      const msgTemplate = messageMap.get('take')
      if (!msgTemplate) continue

      const method = (reminder.method || user.contact_preference || 'email').toLowerCase()
      const channel = method === 'sms' ? 'sms' : 'email'

      let recipient = null
      if (channel === 'sms') {
        recipient = (reminder.to && !reminder.to.includes('@')) ? reminder.to : (user.mobile || user.phone)
      } else {
        recipient = (reminder.to && reminder.to.includes('@')) ? reminder.to : (user.email || user.mobile)
      }

      if (!recipient) continue

      const timeStr = reminder.time || '08:00'
      const [hours = '8', minutes = '0'] = timeStr.split(':')

      const scheduledDate = new Date(today)
      scheduledDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

      const formattedHtml = formatMessageContent(msgTemplate.html || '', user)
      const formattedSubject = formatMessageContent(msgTemplate.subject || 'Daily Take Reminder', user)
      const plainTemplate = msgTemplate.plain || (msgTemplate.html ? msgTemplate.html.replace(/<[^>]*>?/gm, '') : '')
      const contentToSend = channel === 'email' ? formattedHtml : formatMessageContent(plainTemplate, user)

      await dispatchMessage(context, {
        user,
        recipient,
        subject: formattedSubject,
        content: contentToSend,
        type: 'daily_take',
        channel,
        scheduledDate: scheduledDate,
      })
    } catch (err) {
      strapi.log.error(`Error processing take reminder ID ${reminder.id}:`, err)
      if (typeof Sentry?.captureException === 'function') {
        Sentry.captureException(err, { extra: { reminderId: reminder.id } })
      }
    }
  }
}

/**
 * 3. Goal Review Reminders Handler
 */
async function processGoalReminders(context) {
  const { strapi, testUserDocId } = context

  const queryFilters = testUserDocId ? { user: { documentId: testUserDocId } } : {}
  const goals = await strapi.documents('api::goal.goal').findMany({
    filters: queryFilters,
    populate: { user: true },
  })

  const messages = await strapi.documents('api::message.message').findMany()
  const goalMsgTemplate = messages.find((m) => m.type === 'goal_reminder')
  if (!goalMsgTemplate) return

  for (const goal of (goals || [])) {
    try {
      if (!goal.reviewDate) continue

      const goalStatus = (goal.goal_status || '').toLowerCase()
      if (goalStatus !== 'active') continue

      const user = goal.user
      if (!user) continue

      const method = (user.contact_preference || 'email').toLowerCase()
      const channel = method === 'sms' ? 'sms' : 'email'

      let recipient = null
      if (channel === 'sms') {
        recipient = user.mobile || user.phone
      } else {
        recipient = user.email || user.mobile
      }
      if (!recipient) continue

      const reviewDate = new Date(goal.reviewDate)
      if (isNaN(reviewDate.getTime())) continue

      const timeStr = goal.time || '09:00'
      const [hours = '9', minutes = '0'] = timeStr.split(':')
      reviewDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

      const shortType = goal.goaltype || 'goal'
      const longType = shortType.toLowerCase() === 'activity' ? 'being active' : 'eating healthily'

      const formattedHtml = formatMessageContent(goalMsgTemplate.html || '', user, {
        shorttype: shortType,
        longtype: longType,
      })
      const formattedSubject = formatMessageContent(goalMsgTemplate.subject || 'Goal Review', user)
      const plainTemplate = goalMsgTemplate.plain || (goalMsgTemplate.html ? goalMsgTemplate.html.replace(/<[^>]*>?/gm, '') : '')
      const contentToSend = channel === 'email' ? formattedHtml : formatMessageContent(plainTemplate, user, { shorttype: shortType, longtype: longType })

      await dispatchMessage(context, {
        user,
        recipient,
        subject: formattedSubject,
        content: contentToSend,
        type: 'goal_review',
        channel,
        scheduledDate: reviewDate,
      })
    } catch (err) {
      strapi.log.error(`Error processing goal review for goal ID ${goal.id}:`, err)
      if (typeof Sentry?.captureException === 'function') {
        Sentry.captureException(err, { extra: { goalId: goal.id } })
      }
    }
  }
}

/**
 * 4. Weekly and Monthly Nudge Messages Handler
 */
async function processInitNudges(context) {
  const { strapi, testUserDocId } = context

  const userFilters = testUserDocId ? { documentId: testUserDocId } : {}
  const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
    filters: userFilters,
  })

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  for (const user of (users || [])) {
    try {
      if (!user.init || !user.email) continue

      const initDate = new Date(user.init)
      initDate.setHours(8, 0, 0, 0)

      const nudgeSchedulePlan = [
        { type: '2_week', daysOffset: 14 },
        { type: '1_month', monthsOffset: 1 },
        { type: '2_month', monthsOffset: 2 },
      ]

      for (let i = 3; i <= 18; i++) {
        nudgeSchedulePlan.push({ type: `${i}_month`, monthsOffset: i })
      }

      for (const plan of nudgeSchedulePlan) {
        const msgTemplate = messageMap.get(plan.type)
        if (!msgTemplate) continue

        const targetDate = new Date(initDate)
        if (plan.daysOffset) {
          targetDate.setDate(targetDate.getDate() + plan.daysOffset)
        } else if (plan.monthsOffset) {
          targetDate.setMonth(targetDate.getMonth() + plan.monthsOffset)
        }
        targetDate.setHours(8, 0, 0, 0)

        const formattedHtml = formatMessageContent(msgTemplate.html || '', user)
        const formattedSubject = formatMessageContent(msgTemplate.subject || 'Nudge Update', user)

        await dispatchMessage(context, {
          user,
          recipient: user.email,
          subject: formattedSubject,
          content: formattedHtml,
          type: `init_nudge_${plan.type}`,
          channel: 'email',
          scheduledDate: targetDate,
        })
      }
    } catch (err) {
      strapi.log.error(`Error processing init nudge for user ID ${user.id}:`, err)
      if (typeof Sentry?.captureException === 'function') {
        Sentry.captureException(err, { extra: { userId: user.id } })
      }
    }
  }
}