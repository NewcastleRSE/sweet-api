'use strict';

/**
 * tunnel service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::tunnel.tunnel');
