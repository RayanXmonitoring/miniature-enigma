# Stage 1: Build dependencies
FROM node:18-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (termasuk dev)
RUN npm install

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy node_modules dari stage sebelumnya
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Remove dev dependencies
RUN npm prune --production

# Create directories
RUN mkdir -p logs sessions

EXPOSE 3000

CMD ["npm", "start"]
