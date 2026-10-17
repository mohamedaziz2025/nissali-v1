#!/bin/sh
# Reconstruit l API, le web puis Expo, et préchauffe les bundles iOS/Android.
/opt/nissali/deploy/rebuild.sh api
/opt/nissali/deploy/rebuild.sh web
/opt/nissali/deploy/rebuild.sh expo
/opt/nissali/deploy/warm-expo.sh
