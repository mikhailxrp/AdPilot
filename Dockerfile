FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall (prisma generate) нужна схема — генерируем клиент в builder
RUN npm ci --ignore-scripts

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Заглушка только для сборки: реальный URL приходит из Compose при запуске
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# Worker: тот же код и tsx из builder, без Next.js. node — PID 1, SIGTERM доходит до обработчика
FROM builder AS worker
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "worker/index.ts"]
