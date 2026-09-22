
'use strict';

const { recordOutboundAudit } = require('../../../services/outboundAudit.cjs');

const stripHtml = (value = '') => value.replace(/<[^>]*>?/gm, '');
const formatMessage = (value = '', user) => value.replace(/{fullname}/g, `${user?.firstName || ''} ${user?.lastName || ''}`.trim());

async function sendRegistrationMessage(strapi, message, recipient, user, action) {
  const html = formatMessage(message.html || '', user);
  const subject = formatMessage(message.subject || 'HT&Me notification', user);

  try {
    await strapi.plugin('email').service('email').send({
      to: recipient,
      subject,
      text: formatMessage(message.plain || stripHtml(html), user),
      html,
    });
    await recordOutboundAudit(strapi, {
      user,
      action,
      channel: 'email',
      recipient,
      subject,
      messageType: message.type,
    });
  } catch (error) {
    strapi.log.error(`[REGISTRATION EMAIL] Failed to send ${message.type} to ${recipient}:`, error);
  }
}

module.exports = {
  /**
     * @param {{ request: { body: { registrationCode: any; email: any; password: any; firstName: any; lastName: any; phoneNumber: any; }; }; badRequest: (arg0: string) => any; send: (arg0: { jwt: any; user: any; }) => any; }} ctx
     */
  async registerWithCode(ctx) {
    try {
      const { registrationCode, email, password, firstName, lastName, phoneNumber } = ctx.request.body;

      if (!registrationCode || !email || !password) {
        return ctx.badRequest('Missing required fields.');
      }

      // 1. Find the registration code using Strapi v5 Document Service
      const codes = await strapi.documents('api::registration-code.registration-code').findMany({
        filters: { code: registrationCode },
        populate: { user: true },
      });

      if (!codes || codes.length === 0) {
        return ctx.badRequest('This registration code is invalid or has already been used; please contact your study administrator to obtain another one.');
      }

      const codeRecord = codes[0];

      // 2. Check if code is already used
      if (codeRecord.user) {
        return ctx.badRequest('This registration code is invalid or has already been used; please contact your study administrator to obtain another one.');
      }

      // 3. Register the user using the core plugin service
      // (This automatically handles password hashing and user creation)
      const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });
      const settings = /** @type {{ default_role: string }} */ (
        await pluginStore.get({ key: 'advanced' })
      );
      
      const role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: settings.default_role },
      });

      const newUser = await strapi.plugin('users-permissions').service('user').add({
        username: email,
        email: email,
        password: password,
        firstName,
        lastName,
        phoneNumber,
        confirmed: true,
        blocked: false,
        role: role.id,
        contact_preference: 'email'
      });

      // 4. Link the registration code to the new user using Document Service
      await strapi.documents('api::registration-code.registration-code').update({
        documentId: codeRecord.documentId,
        data: {
          user: newUser.id,
        },
      });

      // 5. Issue a JWT token for the new user so they are instantly logged in
      const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: newUser.id });

      const messages = await strapi.documents('api::message.message').findMany({
        filters: { type: { $in: ['welcome', 'notify_message'] } },
      });
      const messageMap = new Map(messages.map((message) => [message.type, message]));
      const welcome = messageMap.get('welcome');
      const notify = messageMap.get('notify_message');

      if (welcome) {
        await sendRegistrationMessage(strapi, welcome, newUser.email, newUser, 'send_notify_register');
      }

      if (notify) {
        await sendRegistrationMessage(strapi, notify, 'htandme@brookes.ac.uk', newUser, 'send_notify_register');
      }

      return ctx.send({
        jwt,
        user: newUser,
      });

    } catch (err) {
      return ctx.badRequest(err instanceof Error ? err.message : 'An error occurred during registration.');
    }
  },
};