// config/cron.js
import { runReminderProcessor } from '../src/services/reminderProcessor'

export default {
  // Run every day at 8:00 AM
  '0 8 * * *': async ({ strapi }) => {
    strapi.log.info('Executing scheduled daily 8am reminder cron job...')
    await runReminderProcessor(strapi)
  },
}