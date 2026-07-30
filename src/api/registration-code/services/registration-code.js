'use strict';

/**
 * registration-code service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::registration-code.registration-code');
