FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 orbit && useradd --system --uid 1001 --gid orbit orbit
COPY --from=builder --chown=orbit:orbit /app/.next/standalone ./
COPY --from=builder --chown=orbit:orbit /app/.next/static ./.next/static
COPY --from=builder --chown=orbit:orbit /app/public ./public
USER orbit
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
