FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist/ dist/

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health/live || exit 1

CMD ["node", "dist/main.js"]
