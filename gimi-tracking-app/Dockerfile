FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# CACHE BUST: 2026-02-28T12:12
RUN npm run build

FROM nginx:stable-alpine

# Copy built assets to Nginx default public folder
COPY --from=builder /app/dist /var/www/html

# If custom nginx config exists for GCP
COPY gcp-nginx-utf8.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
