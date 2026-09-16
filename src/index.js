// src/index.js
export default {
  register(/* { strapi } */) {},

  bootstrap({ strapi }) {
    strapi.documents.use(async (context, next) => {
      const action = context.action
      const uid = context.uid

      const isAuditedType = uid.startsWith('api::') && !uid.includes('audit-log')
      if (!isAuditedType || !['create', 'update', 'delete'].includes(action)) {
        return next()
      }

      let oldData = null
      if ((action === 'update' || action === 'delete') && context.params?.documentId) {
        try {
          oldData = await strapi.documents(uid).findOne({
            documentId: context.params.documentId,
            populate: ['user'],
          })
        } catch (e) {}
      }

      const result = await next()

      try {
        let userId = null
        if (context.params?.data?.user) {
          userId = typeof context.params.data.user === 'object' 
            ? (context.params.data.user.documentId || context.params.data.user.id) 
            : context.params.data.user
        } else if (result?.user) {
          userId = typeof result.user === 'object' ? (result.user.documentId || result.user.id) : result.user
        } else if (oldData?.user) {
          userId = typeof oldData.user === 'object' ? (oldData.user.documentId || oldData.user.id) : oldData.user
        }

        // --- ENHANCED METADATA EXTRACTION ---
        // Look for options passed from custom controllers, or fallback to defaults
        const optionsMeta = context.params?.options || {}
        const platform = optionsMeta.platform || 'Unknown Platform'
        const browser = optionsMeta.browser || 'Unknown Browser'

        await strapi.documents('api::audit-log.audit-log').create({
          data: {
            user: userId,
            platform: platform,
            browser: browser,
            action: action,
            oldData: oldData ? JSON.stringify(oldData) : null,
            newData: result ? JSON.stringify(result) : null,
            datetime: new Date(),
          },
        })
      } catch (logErr) {
        strapi.log.error('Failed to write audit log via middleware:', logErr)
      }

      return result
    })
  },
}