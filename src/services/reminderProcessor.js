import fs from 'fs/promises'
import path from 'path'
import * as Sentry from '@sentry/node'
import outboundAudit from './outboundAudit.cjs'

const { recordOutboundAudit } = outboundAudit

// Concurrency guards to prevent overlapping runs
let isMinuteProcessorRunning = false
let isBulkProcessorRunning = false

/**
 * Helper to detect if running in the Azure Staging environment
 */
function isStagingEnvironment() {
  return (
    process.env.NODE_ENV === 'staging' ||
    process.env.ENVIRONMENT === 'staging' ||
    process.env.WEBSITE_HOSTNAME === 'staging-sweet-strapi-bscvhtg7aqcxexft.ukwest-01.azurewebsites.net'
  )
}

/**
 * 1. Fast Minute Processor (Runs every minute - lightweight & optimized)
 */
export async function runMinuteProcessor(customStrapi = null) {
  const activeStrapi = customStrapi || global.strapi
  if (!activeStrapi) return

  if (isMinuteProcessorRunning) {
    activeStrapi.log.warn('[MINUTE PROCESSOR] Previous minute run still in progress. Skipping.')
    return
  }

  isMinuteProcessorRunning = true

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const context = {
      strapi: activeStrapi,
      today,
      sendMessages: process.env.SEND_MESSAGES === 'true',
      capturedDispatches: [],
    }

    await processDailyTakeReminders(context)
  } catch (error) {
    activeStrapi.log.error('Critical error in minute processor:', error)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(error)
    }
  } finally {
    isMinuteProcessorRunning = false
  }
}

/**
 * 2. Heavy Bulk Processor (Runs hourly/daily - sweeps monthly, goals, and init nudges)
 */
export async function runBulkProcessor(customStrapi = null) {
  const activeStrapi = customStrapi || global.strapi
  if (!activeStrapi) return

  if (isBulkProcessorRunning) {
    activeStrapi.log.warn('[BULK PROCESSOR] Previous bulk run still in progress. Skipping.')
    return
  }

  isBulkProcessorRunning = true

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const testUserDocId = process.env.TEST_USER_DOCUMENT_ID
    const capturedDispatches = []
    const sendMessages = process.env.SEND_MESSAGES === 'true'

    const context = {
      strapi: activeStrapi,
      today,
      testUserDocId,
      sendMessages,
      capturedDispatches,
    }

    await processMonthlyReminders(context)
    await processGoalReminders(context)
    await processInitNudges(context)

    if (!sendMessages && capturedDispatches.length > 0) {
      const outputPath = path.join(process.cwd(), 'all_test_dispatches.json')
      await fs.writeFile(outputPath, JSON.stringify(capturedDispatches, null, 2), 'utf-8')
      activeStrapi.log.info(`[BULK JOB COMPLETE] Wrote ${capturedDispatches.length} simulated dispatches.`)
    }
  } catch (error) {
    activeStrapi.log.error('Critical error in bulk processor:', error)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(error)
    }
  } finally {
    isBulkProcessorRunning = false
  }
}

// Backward compatibility wrapper
export async function runReminderProcessor(customStrapi = null) {
  await runMinuteProcessor(customStrapi)
  await runBulkProcessor(customStrapi)
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
    return false
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
    params.append('from', 'HT&Me')

    const response = await fetch('https://www.firetext.co.uk/api/sendsms', {
      method: 'POST',
      body: params,
    })

    const text = await response.text()
    if (text.includes('Error') || text.includes('failed')) {
      throw new Error(`Firetext API rejected SMS: ${text}`)
    }
    return true
  } catch (err) {
    strapi.log.error(`[FIRETEXT ERROR] Failed to send SMS to ${recipient}:`, err)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(err, { extra: contextMeta })
    }
    return false
  }
}

/**
 * Centralized Dispatch Controller (Handles Staging Prepending)
 */
async function dispatchMessage(context, { user, recipient, subject, content, type, channel, scheduledDate, contextMeta = {} }) {
  const { strapi, sendMessages, capturedDispatches } = context

  let finalSubject = subject
  let finalContent = content

  // Prepend [STAGING] if running in the staging environment
  if (isStagingEnvironment()) {
    if (finalSubject) {
      finalSubject = `[STAGING] ${finalSubject}`
    }
    if (channel === 'sms' && finalContent) {
      finalContent = `[STAGING] ${finalContent}`
    } else if (channel === 'email' && finalContent) {
      finalContent = `<p style="background-color: #fff3cd; color: #856404; padding: 10px; border: 1px solid #ffeeba;"><strong>[STAGING ENVIRONMENT]</strong></p>` + finalContent
    }
  }

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  const metaContext = {
    messageType: type,
    channel,
    recipient,
    userFullName: fullName,
    userId: user?.documentId || user?.id,
    scheduledSendDate: formatLocalDateTime(scheduledDate),
    ...contextMeta,
  }

  if (!sendMessages) {
    capturedDispatches.push({
      timestampGenerated: formatLocalDateTime(new Date()),
      ...metaContext,
      subjectLine: finalSubject || 'N/A',
      messageBody: finalContent,
    })
    return
  }

  // Precise Minute Check for Live Production Mode
  const now = new Date()
  const isDueToday = 
    scheduledDate.getFullYear() === now.getFullYear() &&
    scheduledDate.getMonth() === now.getMonth() &&
    scheduledDate.getDate() === now.getDate()

  const isDueThisMinute = 
    scheduledDate.getHours() === now.getHours() &&
    scheduledDate.getMinutes() === now.getMinutes()

  if (!isDueToday || !isDueThisMinute) {
    return
  }

  try {
    if (channel === 'email') {
      const plainText = finalContent ? finalContent.replace(/<[^>]*>?/gm, '') : ''

      await strapi.plugin('email').service('email').send({
        to: recipient,
        subject: finalSubject,
        text: plainText,
        html: finalContent,
      })
      await recordOutboundAudit(strapi, {
        user,
        action: actionForDispatch({ type, channel, contextMeta }),
        channel,
        recipient,
        subject: finalSubject,
        messageType: type,
      })
      strapi.log.info(`[LIVE EMAIL SENT] Type: ${type} | To: ${recipient}`)

    } else if (channel === 'sms') {
      const plainText = finalContent ? finalContent.replace(/<[^>]*>?/gm, '') : ''
      const smsSent = await sendFiretextSms(strapi, {
        recipient,
        message: plainText,
        contextMeta: metaContext,
      })
      if (smsSent) {
        await recordOutboundAudit(strapi, {
          user,
          action: actionForDispatch({ type, channel, contextMeta }),
          channel,
          recipient,
          subject: finalSubject,
          messageType: type,
        })
      }
      strapi.log.info(`[LIVE SMS SENT] Type: ${type} | To: ${recipient}`)
    }
  } catch (err) {
    strapi.log.error(`[DISPATCH ERROR] Failed to send live ${channel} for type ${type} to ${recipient}:`, err)
    if (typeof Sentry?.captureException === 'function') {
      Sentry.captureException(err, { extra: metaContext })
    }
  }
}

function actionForDispatch({ type, channel, contextMeta }) {
  const prefix = channel === 'sms' ? 'sms' : 'email'

  if (type === 'daily_take') return `${prefix}_daily_reminder`
  if (type === 'goal_review') return `${prefix}_goal_reminder`
  if (type.startsWith('init_nudge_')) return `${prefix}_${type.replace('init_nudge_', '')}_nudge`
  if (type.startsWith('monthly_')) {
    return contextMeta?.reminderType === 'collect'
      ? `${prefix}_monthly_reminder_collect`
      : `${prefix}_monthly_reminder`
  }

  return `${prefix}_${type}`
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
 * 2. Daily Take Reminders Handler (Paginated & safe email resolution)
 */
async function processDailyTakeReminders(context) {
  const { strapi, today } = context
  const testUserDocId = process.env.TEST_USER_DOCUMENT_ID

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  const pageSize = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    const queryFilters = {
      type: 'take',
      ...(testUserDocId ? { user: { documentId: testUserDocId } } : {}),
    }

    const reminders = await strapi.documents('api::reminder.reminder').findMany({
      filters: queryFilters,
      populate: { user: true },
      pagination: { page, pageSize },
    })

    if (!reminders || reminders.length === 0) {
      break
    }

    for (const reminder of reminders) {
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
          recipient = (reminder.to && reminder.to.includes('@')) ? reminder.to : (user.email || null)
        }

        if (!recipient) {
          strapi.log.warn(`[SKIP] Daily take reminder ID ${reminder.id} for user ${user.id} skipped: No valid ${channel} recipient found.`)
          continue
        }

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

    if (reminders.length < pageSize) {
      hasMore = false
    } else {
      page++
    }
  }
}

/**
 * Monthly Reminders Handler (Paginated & safe email resolution)
 */
async function processMonthlyReminders(context) {
  const { strapi, testUserDocId } = context

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  const pageSize = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    const queryFilters = {
      type: { $ne: 'take' },
      ...(testUserDocId ? { user: { documentId: testUserDocId } } : {}),
    }

    const reminders = await strapi.documents('api::reminder.reminder').findMany({
      filters: queryFilters,
      populate: { user: true },
      pagination: { page, pageSize },
    })

    if (!reminders || reminders.length === 0) break

    for (const reminder of reminders) {
      try {
        const user = reminder.user
        if (!user) continue

        const method = (reminder.method || user.contact_preference || 'email').toLowerCase()
        const channel = method === 'sms' ? 'sms' : 'email'

        let recipient = null
        if (channel === 'sms') {
          recipient = (reminder.to && !reminder.to.includes('@')) ? reminder.to : (user.mobile || user.phone)
        } else {
          recipient = (reminder.to && reminder.to.includes('@')) ? reminder.to : (user.email || null)
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
          contextMeta: { reminderType: reminder.reminder_type },
        })
      } catch (err) {
        strapi.log.error(`Error processing monthly reminder ID ${reminder.id}:`, err)
        if (typeof Sentry?.captureException === 'function') {
          Sentry.captureException(err, { extra: { reminderId: reminder.id } })
        }
      }
    }

    if (reminders.length < pageSize) hasMore = false
    else page++
  }
}

/**
 * Goal Review Reminders Handler (Paginated & safe email resolution)
 */
async function processGoalReminders(context) {
  const { strapi, testUserDocId } = context

  const messages = await strapi.documents('api::message.message').findMany()
  const goalMsgTemplate = messages.find((m) => m.type === 'goal_reminder')
  if (!goalMsgTemplate) return

  const pageSize = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    const queryFilters = {
      goal_status: 'active',
      ...(testUserDocId ? { user: { documentId: testUserDocId } } : {}),
    }

    const goals = await strapi.documents('api::goal.goal').findMany({
      filters: queryFilters,
      populate: { user: true },
      pagination: { page, pageSize },
    })

    if (!goals || goals.length === 0) break

    for (const goal of goals) {
      try {
        if (!goal.reviewDate) continue
        const user = goal.user
        if (!user) continue

        const method = (user.contact_preference || 'email').toLowerCase()
        const channel = method === 'sms' ? 'sms' : 'email'

        let recipient = channel === 'sms' ? (user.mobile || user.phone) : (user.email || null)
        if (!recipient) continue

        const reviewDate = new Date(goal.reviewDate)
        if (isNaN(reviewDate.getTime())) continue

        const timeStr = goal.time || '09:00'
        const [hours = '9', minutes = '0'] = timeStr.split(':')
        reviewDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

        const shortType = goal.goaltype || 'goal'
        const longType = shortType.toLowerCase() === 'activity' ? 'being active' : 'eating healthily'

        const formattedHtml = formatMessageContent(goalMsgTemplate.html || '', user, { shorttype: shortType, longtype: longType })
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

    if (goals.length < pageSize) hasMore = false
    else page++
  }
}

/**
 * Weekly and Monthly Nudge Messages Handler (Paginated)
 */
async function processInitNudges(context) {
  const { strapi, testUserDocId } = context

  const messages = await strapi.documents('api::message.message').findMany()
  const messageMap = new Map(messages.map((m) => [m.type, m]))

  const pageSize = 50
  let page = 1
  let hasMore = true

  while (hasMore) {
    const userFilters = testUserDocId ? { documentId: testUserDocId } : {}
    
    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: userFilters,
      pagination: { page, pageSize },
    })

    if (!users || users.length === 0) break

    for (const user of users) {
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

    if (users.length < pageSize) hasMore = false
    else page++
  }
}