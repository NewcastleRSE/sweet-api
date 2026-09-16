'use strict';

/**
 * audit-log controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::audit-log.audit-log');
