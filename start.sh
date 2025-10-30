#!/bin/bash

echo "🚀 Starting Cypress Pop Services..."

# Check if development mode is requested
DEV_MODE=false
if [[ "$1" == "--dev" || "$1" == "-d" ]]; then
    DEV_MODE=true
    echo "🔧 Development mode enabled - hot reloading active!"
fi

# Check if Docker is available and determine compose command
COMPOSE_CMD=""
if command -v docker &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    fi
fi

if [ -n "$COMPOSE_CMD" ]; then
    echo "🐳 Docker detected - starting with Docker Compose..."
    echo "📡 API Server will be available at http://localhost:3000"
    echo "🎬 Converter service will be available for WebP to MP4 conversion"
    echo ""
    
    if [ "$DEV_MODE" = true ]; then
        echo "🔄 Hot reloading enabled - changes will auto-restart server"
        echo "📋 Available commands:"
        echo "  - View logs: $COMPOSE_CMD -f docker-compose.dev.yml logs -f"
        echo "  - Stop services: $COMPOSE_CMD -f docker-compose.dev.yml down"
        echo "  - Restart: $COMPOSE_CMD -f docker-compose.dev.yml restart"
        echo ""
        $COMPOSE_CMD -f docker-compose.dev.yml up --build
    else
        echo "📋 Available commands:"
        echo "  - View logs: $COMPOSE_CMD logs -f"
        echo "  - Stop services: $COMPOSE_CMD down"
        echo "  - Restart: $COMPOSE_CMD restart"
        echo "  - Start with hot reload: ./start.sh --dev"
        echo ""
        $COMPOSE_CMD up --build
    fi
else
    echo "📦 Docker not found - starting services individually..."
    echo ""
    
    # Start API Server
    echo "🚀 Starting API Server..."
    cd server
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing API dependencies..."
        npm install
    fi
    
    if [ "$DEV_MODE" = true ]; then
        echo "🔄 Starting with nodemon for hot reloading..."
        npm run dev &
    else
        npm start &
    fi
    API_PID=$!
    cd ..
    
    echo "✅ API Server started (PID: $API_PID)"
    echo "📡 API available at http://localhost:3000"
    echo ""
    echo "💡 To stop services, press Ctrl+C"
    
    # Wait for user to stop
    wait $API_PID
fi 