FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies (needed for Prisma and ts-node at build/startup)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and configuration files
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build the NestJS project
COPY . .
RUN npm run build

# Expose port
EXPOSE 3000

# Start script: run migrations first, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
