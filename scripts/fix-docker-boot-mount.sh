#!/usr/bin/env bash
set -euo pipefail

# SQDIS - Ensure Docker daemon waits for secondary storage mount on system boot.
# This prevents race conditions where containers start before the drive is mounted.

MOUNT_POINT="/mnt/fd0774e4-49a5-48a3-b6a2-ef28882efa71"
DROPIN_DIR="/etc/systemd/system/docker.service.d"
CONF_FILE="${DROPIN_DIR}/mounts.conf"

if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)." >&2
  exit 1
fi

echo "Creating systemd drop-in directory at ${DROPIN_DIR}..."
mkdir -p "${DROPIN_DIR}"

cat > "${CONF_FILE}" <<EOF
[Unit]
RequiresMountsFor=${MOUNT_POINT}
EOF

echo "Written configuration to ${CONF_FILE}:"
cat "${CONF_FILE}"

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Done. docker.service is now configured to start only after ${MOUNT_POINT} is mounted."
