'use strict';
import * as Sentry from '@sentry/node'
export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},


  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/*{ strapi }*/) {
    // Initialize Sentry with your DSN from environment variables
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0,
      })
      strapi.log.info('Sentry initialized successfully.')
    } else {
      strapi.log.warn('SENTRY_DSN not found in environment variables. Sentry logging is disabled.')
    }
  
  },

};
