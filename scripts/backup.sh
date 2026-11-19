#!/usr/bin/env bash
# Notifiq sqlite backup — runs on ghost via systemd timer.
# Consistent snapshot via sqlite's backup API inside the running api container,
# then copied out of the docker volume to ~/notifiq-backups (14-day retention).
set -euo pipefail

DEST=${NOTIFIQ_BACKUP_DIR:-$HOME/notifiq-backups}
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)

docker exec soonish-api-1 python3 -c "
import sqlite3
src = sqlite3.connect('/data/notifiq.db')
dst = sqlite3.connect('/tmp/notifiq-backup.db')
src.backup(dst)
dst.close(); src.close()
"
docker cp soonish-api-1:/tmp/notifiq-backup.db "$DEST/notifiq-$STAMP.db"
docker exec soonish-api-1 rm /tmp/notifiq-backup.db
find "$DEST" -name 'notifiq-*.db' -mtime +14 -delete
echo "backup: $DEST/notifiq-$STAMP.db"
