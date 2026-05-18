#!/bin/bash
set -e

echo ">>> Actualizando sistema..."
apt-get update -y
apt-get install -y curl git nginx

echo ">>> Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo ">>> Instalando PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

echo ">>> Configurando PostgreSQL..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'winnerdrop2026';"
sudo -u postgres psql -c "SELECT 'CREATE DATABASE winnerdrop' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'winnerdrop')\\gexec"

echo ">>> Instalando PM2..."
npm install -g pm2

echo ">>> Instalando dependencias de Playwright..."
apt-get install -y libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 \
  libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2 libx11-6 libxext6 \
  libx11-xcb1 libxcb1 libxcb-dri3-0 libxshmfence1

echo ">>> Clonando repositorio..."
mkdir -p /opt/winnerdrop
cd /opt/winnerdrop
git clone https://github.com/soportekababa-a11y/WINNERDROP.git . 2>/dev/null || git pull origin master

echo ">>> Construyendo backend..."
cd /opt/winnerdrop/backend
npm install
npm run build

echo ">>> Instalando Chromium para Playwright..."
cd /opt/winnerdrop/backend
npx playwright install chromium --with-deps

echo ">>> Construyendo frontend..."
cd /opt/winnerdrop/frontend
npm install
cat > .env.local << 'ENVEOF'
BACKEND_URL=http://localhost:3001
ENVEOF
npm run build

echo ">>> Creando ecosystem.config.js para Linux..."
cat > /opt/winnerdrop/ecosystem.config.js << 'ECOEOF'
module.exports = {
  apps: [
    {
      name: 'winnerdrop-backend',
      cwd: '/opt/winnerdrop/backend',
      script: 'dist/main.js',
      watch: false,
      env: {
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'winnerdrop2026',
        DB_DATABASE: 'winnerdrop',
        EFFI_EMAIL: 'soportekababa@gmail.com',
        EFFI_PASSWORD: 'Davdem.Online',
        JWT_SECRET: 'winnerdrop_jwt_secret_2026_change_in_prod',
        PORT: '3001',
      },
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 999,
    },
    {
      name: 'winnerdrop-frontend',
      cwd: '/opt/winnerdrop/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        BACKEND_URL: 'http://localhost:3001',
      },
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 999,
    },
  ],
};
ECOEOF

echo ">>> Iniciando apps con PM2..."
cd /opt/winnerdrop
pm2 start ecosystem.config.js
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | bash

echo ">>> Configurando Nginx..."
cat > /etc/nginx/sites-available/winnerdrop << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/winnerdrop /etc/nginx/sites-enabled/winnerdrop
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "=============================="
echo "INSTALACION COMPLETA"
echo "=============================="
echo "App disponible en: http://116.203.82.110"
pm2 list
