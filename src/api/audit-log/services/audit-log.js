'use strict';

/**
 * audit-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::audit-log.audit-log');
