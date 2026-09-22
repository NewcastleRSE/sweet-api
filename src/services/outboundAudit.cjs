async function recordOutboundAudit(strapi, { user, action, channel, recipient, subject, messageType }) {
  try {
    await strapi.documents('api::audit-log.audit-log').create({
      data: {
        user: user?.documentId || user?.id || null,
        action,
        platform: 'server',
        browser: channel,
        http_status: 'sent',
        datetime: new Date(),
        newData: {
          channel,
          recipient,
          subject,
          messageType,
        },
      },
    });
  } catch (error) {
    strapi.log.error('[OUTBOUND AUDIT] Failed to record message audit:', error);
  }
}

module.exports = { recordOutboundAudit };
