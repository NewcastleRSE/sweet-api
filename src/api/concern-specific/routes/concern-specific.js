'use strict';

/**
 * concern-specific router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::concern-specific.concern-specific');
