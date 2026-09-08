#!/bin/bash
# Restore the pre-H-06 root FX/mail worker. Never start two worker sets.
set -euo pipefail

BACKUP="${1:-/var/backups/tripetica-h06}"

if [[ ! -f "$BACKUP/tripetica-fx-refresh.service" || ! -f "$BACKUP/tripetica-fx-refresh.timer" ]]; then
  echo "H-06 backup units are missing in $BACKUP" >&2
  exit 1
fi

systemctl stop tripetica-fx-refresh.timer tripetica-payment-pending-expire.timer 2>/dev/null || true
systemctl stop tripetica-fx-refresh.service tripetica-payment-pending-expire.service 2>/dev/null || true
systemctl disable tripetica-payment-pending-expire.timer 2>/dev/null || true

install -o root -g root -m 644 \
  "$BACKUP/tripetica-fx-refresh.service" \
  /etc/systemd/system/tripetica-fx-refresh.service
install -o root -g root -m 644 \
  "$BACKUP/tripetica-fx-refresh.timer" \
  /etc/systemd/system/tripetica-fx-refresh.timer

systemctl daemon-reload
systemctl reset-failed tripetica-fx-refresh.service || true
systemctl start tripetica-fx-refresh.timer
systemctl is-active tripetica-fx-refresh.timer
systemctl show tripetica-fx-refresh.service -p User,WorkingDirectory --no-pager
