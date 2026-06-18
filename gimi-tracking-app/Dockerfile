FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# CACHE BUST: 2026-06-17T18:50
RUN npm run build

FROM nginx:stable-alpine

# Copy built assets to Nginx default public folder
COPY --from=builder /app/dist /var/www/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
