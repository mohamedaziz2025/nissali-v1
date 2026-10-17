#!/bin/sh
# Usage : rebuild.sh <service> — reconstruit et relance un service sans dépendre de la session SSH.
cd /opt/nissali/deploy
{ docker compose build "$1" && docker compose up -d --no-deps "$1"; echo "FIN $?"; } > "/tmp/nissali-$1-build.log" 2>&1
