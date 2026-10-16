FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Les « rewrites » /api → API sont figées au build.
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
RUN npx next build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
USER node
EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001"]
