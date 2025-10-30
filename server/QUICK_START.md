# Quick Start Guide

## 🚀 Start the API Server

### Option 1: Using Docker (Recommended)
```bash
cd server
docker-compose up --build
```

### Option 2: Using the startup script
```bash
cd server
./start.sh
```

### Option 3: Manual start
```bash
cd server
npm install
npm start
```

## 📡 API Endpoints

Once running, the API will be available at `http://localhost:3000`

### Quick Tests

1. **Health Check:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Get Available Idols:**
   ```bash
   curl http://localhost:3000/idols
   ```

3. **Start a Download:**
   ```bash
   curl -X POST http://localhost:3000/download \
     -H "Content-Type: application/json" \
     -d '{"idolName": "jihyo", "start": 1, "end": 5}'
   ```

4. **Check Download Status:**
   ```bash
   curl http://localhost:3000/downloads/jihyo
   ```

## 🧪 Test the API

Run the test script to verify everything works:
```bash
cd server
node test-api.js
```

## 📁 Files Created

- `server.js` - Main API server (converted from main.js)
- `package.json` - Dependencies and scripts
- `Dockerfile` - Docker configuration
- `docker-compose.yml` - Easy Docker deployment
- `README.md` - Full documentation
- `test-api.js` - API testing script
- `example-client.js` - Example client usage
- `start.sh` - Easy startup script

## 🔄 What Changed

The original `main.js` command-line script has been converted to a REST API with:

- **POST /download** - Start image downloads
- **GET /health** - Server health check
- **GET /idols** - List available idols
- **GET /downloads/:idolName** - Check download status

## 🐳 Docker Benefits

- Easy deployment
- Consistent environment
- Built-in health checks
- Volume mounting for downloads
- Automatic restart on failure 