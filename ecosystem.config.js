module.exports = {
  apps: [
    {
      name: 'winnerdrop-backend',
      cwd: 'C:\\Users\\dioni\\winnerdrop\\backend',
      script: 'dist/main.js',
      watch: false,
      env: { NODE_ENV: 'production' },
      out_file: 'C:\\Users\\dioni\\winnerdrop\\backend\\pm2-out.log',
      error_file: 'C:\\Users\\dioni\\winnerdrop\\backend\\pm2-err.log',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'winnerdrop-frontend',
      cwd: 'C:\\Users\\dioni\\winnerdrop\\frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      watch: false,
      env: { NODE_ENV: 'production', PORT: '3000' },
      out_file: 'C:\\Users\\dioni\\winnerdrop\\frontend\\pm2-out.log',
      error_file: 'C:\\Users\\dioni\\winnerdrop\\frontend\\pm2-err.log',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
