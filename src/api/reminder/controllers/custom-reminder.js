import { runReminderProcessor } from '../../../services/reminderProcessor.js'

export default {
  async triggerTest(ctx) {
    try {
      console.log('Manual trigger initiated for reminder processor.')
      
      // Run the processor asynchronously or synchronously
      await runReminderProcessor(ctx.strapi)

      return ctx.send({ message: 'Reminder processor executed successfully.' })
    } catch (error) {
      console.log('Manual trigger failed:', error)
      return ctx.internalServerError({ error: error.message })
    }
  },
}