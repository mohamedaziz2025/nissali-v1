# Serveur Metro pour ouvrir l'app dans Expo Go depuis un serveur distant.
FROM node:22-alpine
WORKDIR /app
ENV CI=1 EXPO_NO_TELEMETRY=1 NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
# `--tunnel` en mode CI : évite l'invite d'installation interactive.
RUN npm install -g @expo/ngrok@^4.1.0 --no-audit --no-fund
COPY . .
# Metro fige EXPO_PUBLIC_* dans le bundle : adresse publique de l'API.
ARG EXPO_PUBLIC_API_URL=https://api.nissali.fr/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ARG METRO_PORT=8102
ENV METRO_PORT=$METRO_PORT
EXPOSE 8102
HEALTHCHECK --interval=30s --timeout=8s --start-period=180s --retries=5 CMD wget -qO- http://127.0.0.1:${METRO_PORT}/ >/dev/null || exit 1
# Tunnel HTTPS Expo (exp.direct) pour Expo Go + port publié pour le lien exp://IP:port.
CMD ["sh", "-c", "npx expo start --tunnel --port ${METRO_PORT} --clear"]
