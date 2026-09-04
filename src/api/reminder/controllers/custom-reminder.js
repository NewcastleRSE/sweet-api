import { runReminderProcessor } from '../../../services/reminderProcessor.js'

export default {
  async triggerTest(ctx) {
    try {
      ctx.strapi.log.info('Manual trigger initiated for reminder processor.')
      
      // Run the processor asynchronously or synchronously
      await runReminderProcessor(ctx.strapi)

      return ctx.send({ message: 'Reminder processor executed successfully.' })
    } catch (error) {
      ctx.strapi.log.error('Manual trigger failed:', error)
      return ctx.internalServerError({ error: error.message })
    }
  },
}