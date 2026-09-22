'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/profiler/latest',
      handler: 'profiler.latest',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/profiler/responses',
      handler: 'profiler.responses',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/profiler/submit',
      handler: 'profiler.submit',
      config: { auth: {} },
    },
  ],
};
