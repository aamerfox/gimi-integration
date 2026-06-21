FROM node:18-alpine

# Install build dependencies for sqlite3 (node-gyp requirements)
RUN apk add --no-python --no-cache make gcc g++ python3

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY server.js ./

EXPOSE 5000

ENV PORT=5000

CMD ["node", "server.js"]
