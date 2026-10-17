#!/bin/sh
# Pré-compile les bundles iOS et Android de Metro (première ouverture rapide dans Expo Go).
manifest_url() {
  curl -s -m 30 -H "expo-platform: $1" -H "Accept: application/expo+json,application/json" http://127.0.0.1:8102/ \
    | python3 -c "import sys,json;d=json.load(sys.stdin);m=d.get(\"manifest\",d);print(m[\"launchAsset\"][\"url\"])" 2>/dev/null \
    | sed -E "s#https?://[^/]+#http://127.0.0.1:8102#"
}
{
for p in ios android; do
  n=0; u=""
  while [ -z "$u" ] && [ $n -lt 60 ]; do u=$(manifest_url $p); [ -z "$u" ] && sleep 5; n=$((n+1)); done
  curl -s -o /dev/null -w "$p %{http_code} %{size_download} octets %{time_total}s\n" --max-time 900 "$u"
done
echo FIN
} > /tmp/nissali-expo-warm.log 2>&1
