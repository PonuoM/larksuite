# Workboard production image: builds the React bundle for the site root, then serves it with the PHP API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public
RUN WORKBOARD_BASE=/ node scripts/build.mjs

FROM php:8.3-apache
# Caddy is the only client. With KeepAlive On, prefork kept a worker waiting 5 s on each of Caddy's idle
# connections, so the calendar's 18 parallel requests needed 18 workers and Apache adds them only 1, 2, 4, 8
# per second: the last requests waited 3-4 s (measured 2026-09-19). Without keep-alive a worker is free right
# after its ~5 ms reply; reconnecting over the Docker network costs nothing. A larger idle pool covers several users.
RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite headers \
 && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf \
 && printf 'ServerTokens Prod\nServerSignature Off\nKeepAlive Off\nStartServers 10\nMinSpareServers 10\nMaxSpareServers 20\n' > /etc/apache2/conf-enabled/zz-workboard.conf \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
 && printf 'expose_php = Off\n' > "$PHP_INI_DIR/conf.d/zz-workboard.ini"
WORKDIR /var/www/html
# .htaccess only exposes /, /assets/* and /api/v1/*; everything else (api/, .env) returns 403.
COPY .htaccess ./
COPY api/bootstrap.php api/meetings.php api/task-updates.php api/developers.php ./api/
COPY --from=build /app/public ./public
