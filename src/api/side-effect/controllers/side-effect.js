'use strict';

/**
 * side-effect controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::side-effect.side-effect');
