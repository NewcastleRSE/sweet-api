module.exports = ({ env }) => {
  const azureBlobHost = env('AZURE_STORAGE_ACCOUNT')
    ? [`https://${env('AZURE_STORAGE_ACCOUNT')}.blob.core.windows.net`]
    : [];

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', ...azureBlobHost],
            'media-src': ["'self'", 'data:', 'blob:', ...azureBlobHost],
          },
        },
      },
    },
    'strapi::cors',
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
    'global::audit-logger',
  ];
};
