#!/bin/sh
# Reconstruit et relance Metro (Expo) sans dépendre de la session SSH.
cd /opt/nissali/deploy
{ docker compose build expo && docker compose up -d --no-deps expo; echo "FIN $?"; } > /tmp/nissali-expo-build.log 2>&1
