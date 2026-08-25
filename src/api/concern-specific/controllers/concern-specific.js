'use strict';

/**
 * concern-specific controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::concern-specific.concern-specific');
