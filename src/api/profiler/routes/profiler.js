'use strict';

/**
 * profiler router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::profiler.profiler');
