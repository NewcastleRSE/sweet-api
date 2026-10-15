// config/cron-tasks.js
import { runMinuteProcessor, runBulkProcessor } from '../src/services/reminderProcessor.js';

export default {
  // Fast task running every minute strictly for time-sensitive notifications
  minuteReminderJob: {
    task: async ({ strapi }) => {
      strapi.log.info('Executing minute reminder check...');
      await runMinuteProcessor(strapi);
    },
    options: {
      rule: '* * * * *', // Every minute
    },
  },

  // Heavy task running once an hour for bulk sweeps (monthly, goals, init nudges)
  bulkReminderJob: {
    task: async ({ strapi }) => {
      strapi.log.info('Executing bulk reminder/nudge check...');
      await runBulkProcessor(strapi);
    },
    options: {
      rule: '0 * * * *', // Once every hour
    },
  },
};