'use strict';

/**
 * profiler controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::profiler.profiler');
