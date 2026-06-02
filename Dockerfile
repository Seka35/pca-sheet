# Build stage
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copier les fichiers de dépendances de la racine et du dashboard
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

# Installer les dépendances (racine et dashboard)
RUN npm install && npm rebuild sqlite3 --build-from-source
RUN cd dashboard && npm install && npm rebuild sqlite3 --build-from-source

# Copier tout le reste
COPY . .

# Build du dashboard Next.js
RUN cd dashboard && npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copier les fichiers nécessaires de la racine
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/sync.js ./
COPY --from=builder /app/db.js ./

# Copier les fichiers du dashboard
COPY --from=builder /app/dashboard/package*.json ./dashboard/
COPY --from=builder /app/dashboard/.next ./dashboard/.next
COPY --from=builder /app/dashboard/public ./dashboard/public
COPY --from=builder /app/dashboard/node_modules ./dashboard/node_modules

# Créer le dossier pour la DB SQLite et lui donner les droits
RUN mkdir -p dashboard/src/lib && chown -R node:node dashboard/src/lib

EXPOSE 3000
ENV NODE_ENV=production

# On lance le dashboard depuis son dossier
WORKDIR /app/dashboard
CMD ["npm", "start"]
