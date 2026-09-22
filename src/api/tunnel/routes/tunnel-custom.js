'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/tunnels/schema', handler: 'tunnel.schema', config: { auth: {} } },
    { method: 'POST', path: '/tunnels/:slug/complete', handler: 'tunnel.complete', config: { auth: {} } },
  ],
};