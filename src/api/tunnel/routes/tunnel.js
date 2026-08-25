'use strict';

/**
 * tunnel router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::tunnel.tunnel');
