// config/cron-tasks.js (or config/cron-tasks.ts)
import { runReminderProcessor } from '../src/services/reminderProcessor.js';

export default {
  // Give your job a unique name (avoid anonymous key formats)
  reminderJob: {
    task: async ({ strapi }) => {
      strapi.log.info('Executing scheduled reminder cron job...');
      await runReminderProcessor(strapi);
    },
    options: {
      rule: '* * * * *', // Run every minute
    },
  },
};