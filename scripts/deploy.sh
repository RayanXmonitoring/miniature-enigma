#!/bin/bash

# Build Docker image
echo "Building Docker image..."
docker build -t telegram-member-mover .

# Run locally for testing
echo "Testing locally..."
docker run -d -p 3000:3000 --env-file .env --name test-container telegram-member-mover

# Wait for container to start
sleep 5

# Test health endpoint
curl http://localhost:3000/api/health

# Stop and remove test container
docker stop test-container
docker rm test-container

echo "✅ Build successful!"
