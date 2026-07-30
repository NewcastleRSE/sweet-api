'use strict';

/**
 * side-effect router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::side-effect.side-effect');
