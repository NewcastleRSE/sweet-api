'use strict';

/**
 * side-effect service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::side-effect.side-effect');
