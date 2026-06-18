FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# CACHE BUST: 2026-04-15
RUN npm run build

FROM nginx:stable-alpine

# Copy built assets to Nginx default public folder
COPY --from=builder /app/dist /var/www/html

# Replace default Nginx configuration
COPY gimi-consumer-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
