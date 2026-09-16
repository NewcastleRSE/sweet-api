// src/middlewares/audit-logger.js
export default (config, { strapi }) => {
  return async (ctx, next) => {
    await next()

    const isPageFetch = ctx.request.path.includes('/api/pages')
    const isPostAction = ctx.request.method === 'POST'

    if (isPageFetch || isPostAction) {
      try {
        const body = ctx.request.body?.data || ctx.request.body || {}
        
        // 1. User Resolution (Now catches the Authorization header if sent by frontend)
        let userId = null
        if (ctx.state.user && ctx.state.user.documentId) {
          userId = ctx.state.user.documentId
        } else {
          try {
            const authHeader = ctx.request.header.authorization
            if (authHeader && authHeader.startsWith('Bearer ')) {
              const token = authHeader.substring(7)
              const jwtService = strapi.plugin('users-permissions').service('jwt')
              const decoded = await jwtService.verify(token)
              if (decoded && decoded.id) {
                const foundUser = await strapi.documents('plugin::users-permissions.user').findOne({
                  filters: { id: decoded.id }
                })
                if (foundUser) {
                  userId = foundUser.documentId
                }
              }
            }
          } catch (jwtErr) {}
        }

        const platform = ctx.request.headers['sec-ch-ua-platform'] || body.platform || 'Unknown'
        const browser = ctx.request.headers['user-agent'] || body.browser || 'Unknown'

        // 2. Clean Slug Extraction for Destination
        let destinationSlug = body.destination || body.page
        if (isPageFetch) {
          try {
            const fullUrl = `http://localhost${ctx.request.url}`
            const urlObj = new URL(fullUrl)
            const slugParam = urlObj.searchParams.get('filters[slug][$eq]') || 
                              urlObj.searchParams.get('filters[slug]') || 
                              urlObj.searchParams.get('slug')
            if (slugParam) {
              destinationSlug = slugParam.replace(/_/g, '/')
            } else {
              destinationSlug = ctx.request.url
            }
          } catch (e) {
            destinationSlug = ctx.request.url
          }
        }

        // 3. Capture Referrer from the custom frontend header
        let referrerSlug = body.referrer || ctx.request.headers['x-referrer'] || 'home'
        // Clean up leading/trailing slashes if passed as a path
        referrerSlug = referrerSlug.replace(/^\/+/, '').replace(/\/+$/, '')
        if (referrerSlug === '' || referrerSlug === 'localhost:3000') {
          referrerSlug = 'home'
        }

        await strapi.documents('api::audit-log.audit-log').create({
          data: {
            user: userId,
            platform: platform,
            browser: browser,
            action: isPageFetch ? 'navigate' : (body.action || 'action'),
            page: destinationSlug || ctx.request.path,
            referrer: referrerSlug,
            destination: destinationSlug,
            http_status: String(ctx.status),
            datetime: new Date(),
          },
        })
      } catch (err) {
        strapi.log.error('Error saving automatic audit log:', err)
      }
    }
  }
}