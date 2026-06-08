# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy configuration and source files
COPY . .

# Set Vite environment variables at build time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the React application
RUN npm run build

# Production stage using Nginx
FROM nginx:alpine

# Copy built static files to Nginx public folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
