# 🚀 Quick Reference

## Start Services
```bash
# Start both services (production)
docker-compose up --build

# Start with hot reloading (development)
./start.sh --dev
# or
docker-compose -f docker-compose.dev.yml up --build

# Start with startup script
./start.sh
```

## API Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Get idols
curl http://localhost:3000/idols

# Download images
curl -X POST http://localhost:3000/download \
  -H "Content-Type: application/json" \
  -d '{"idolName": "jihyo", "start": 1, "end": 5}'

# Check downloads
curl http://localhost:3000/downloads/jihyo
```

## Converter API Usage
```bash
# Health check
curl http://localhost:5000/health

# List files
curl http://localhost:5000/files

# Upload and convert single file
curl -X POST http://localhost:5000/convert \
  -F "file=@your_file.webp"

# Convert all files in input directory
curl -X POST http://localhost:5000/convert/batch

# Download converted file
curl -O http://localhost:5000/download/filename.mp4

# Clear all files
curl -X POST http://localhost:5000/clear
```

## Docker Commands
```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild services
docker-compose build --no-cache
```

## File Locations
- **Downloads:** `./downloads/`
- **Converter Input:** `./converter/input/`
- **Converter Output:** `./converter/output/`

## Service Ports
- **API Server:** http://localhost:3000
- **Converter API:** http://localhost:5000

## Health Checks
```bash
# API Health
curl http://localhost:3000/health

# Docker Services
docker-compose ps
``` 