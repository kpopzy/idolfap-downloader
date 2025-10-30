#!/bin/bash

echo "🚀 Starting Cypress Pop API Server..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected - starting with Docker Compose..."
    docker-compose up --build
else
    echo "📦 Running locally with npm..."
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing dependencies..."
        npm install
    fi
    
    echo "🚀 Starting server..."
    npm start
fi 