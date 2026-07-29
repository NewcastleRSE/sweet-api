'use strict';

/**
 * profiler service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::profiler.profiler');
