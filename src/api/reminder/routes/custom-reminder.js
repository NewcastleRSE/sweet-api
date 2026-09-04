export default {
  routes: [
    {
      method: 'POST',
      path: '/reminders/trigger-test',
      handler: 'custom-reminder.triggerTest',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}