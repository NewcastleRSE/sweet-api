// Path: src/api/registration-code/routes/custom-register.js
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/registration-codes/register',
      handler: 'custom-register.registerWithCode',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Publicly accessible so new users can register
      },
    },
  ],
};