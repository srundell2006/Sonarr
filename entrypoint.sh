#!/bin/bash
set -e

# Re-map abc user/group to the requested PUID/PGID
groupmod -o -g "${PGID}" abc
usermod  -o -u "${PUID}" abc

# Set timezone
if [ -n "${TZ}" ]; then
    ln -snf /usr/share/zoneinfo/"${TZ}" /etc/localtime
    echo "${TZ}" > /etc/timezone
fi

# Ensure config dir is owned by the runtime user
chown -R abc:abc /config

# Drop privileges and run Sonarr
exec runuser -u abc -- /app/sonarr/bin/Sonarr -nobrowser -data=/config
