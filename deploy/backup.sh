#!/bin/sh
# Daily Workboard database dump, kept 14 days. Installed as /etc/cron.d/workboard-backup on the VPS.
set -eu
umask 077
dir=/opt/backups/workboard
mkdir -p "$dir"
file="$dir/workboard-$(date +%F).sql.gz"
docker exec workboard-db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction workboard' | gzip > "$file.tmp"
mv "$file.tmp" "$file"
find "$dir" -name 'workboard-*.sql.gz' -mtime +14 -delete
