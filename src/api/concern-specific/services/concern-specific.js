'use strict';

/**
 * concern-specific service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::concern-specific.concern-specific');
