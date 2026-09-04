const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

/**
 * @param {{ env: (key: string, defaultValue?: any) => any }} props
 */
module.exports = ({ env }) => ({
  'deep-populate': {
    enabled: true,
  },
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d', 
      },
      jwtManagement: 'refresh',
      sessions: {
        httpOnly: true,
      },
    },
  },
  'refresh-token': {
    config: {
      refreshTokenExpiresIn: '30d', 
      refreshTokenSecret: env('REFRESH_JWT_SECRET'),
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes: deniedExecutableTypes,
      },
    },
  },
  'strapi-v5-plugin-populate-deep': {
    enabled: true,
    config: {
      defaultDepth: 15, // Sets how many levels deep it will automatically look (default is 5)
    },
  },
});
