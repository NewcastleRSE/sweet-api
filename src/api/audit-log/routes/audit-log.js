'use strict';

/**
 * audit-log router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::audit-log.audit-log');
