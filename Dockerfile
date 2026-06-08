# Build stage
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copier le manifest dashboard et installer les dépendances
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm install && npm rebuild better-sqlite3 --build-from-source

# Copier le code source et builder
COPY . .
RUN cd dashboard && npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Installer Chromium pour Puppeteer
RUN apk add --no-cache chromium

# Copier le dashboard buildé + ses node_modules
COPY --from=builder /app/dashboard/package*.json ./dashboard/
COPY --from=builder /app/dashboard/.next ./dashboard/.next
COPY --from=builder /app/dashboard/public ./dashboard/public
COPY --from=builder /app/dashboard/node_modules ./dashboard/node_modules

# Copier les scripts pour génération PDF
COPY --from=builder /app/dashboard/scripts ./dashboard/scripts

# Copier les polices pdfkit (Helvetica.afm) pour la génération PDF
COPY --from=builder /app/dashboard/node_modules/pdfkit/js/data/Helvetica*.afm ./dashboard/.next/server/chunks/data/
COPY --from=builder /app/dashboard/node_modules/pdfkit/js/data/Courier*.afm ./dashboard/.next/server/chunks/data/

# Créer le dossier pour la DB SQLite et lui donner les droits
RUN mkdir -p dashboard/src/lib && chown -R node:node dashboard/src/lib

EXPOSE 3000
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app/dashboard
CMD ["npm", "start"]
