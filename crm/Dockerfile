FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV PORT=3000 DATABASE_PATH=/data/crm.db TRUST_PROXY=true
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/auth/me >/dev/null 2>&1 || exit 0
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
