# Cypress Pop - Image Downloader & Converter

A complete Docker-based solution for downloading and converting images from idol websites.

## 🏗️ Architecture

This project consists of two main services:

1. **API Server** (`server/`) - Downloads images using Puppeteer (Node.js/Express)
2. **Converter** (`converter/`) - Converts WebP images to MP4 videos (Python/Flask)

## 🚀 Quick Start

### Using Docker Compose (Recommended)

Start both services with a single command:

```bash
docker-compose up --build
```

This will start:
- **API Server** on `http://localhost:3000`
- **Converter API** on `http://localhost:5000`

### Development Mode with Hot Reloading

For development with automatic restart on file changes:

```bash
# Using the startup script
./start.sh --dev

# Or directly with docker-compose
docker-compose -f docker-compose.dev.yml up --build
```

**Features:**
- 🔄 **Hot reloading** - Server restarts automatically when files change
- 📁 **Volume mounting** - Changes to server code are reflected immediately
- 🐛 **Development mode** - Better error messages and debugging
- 📊 **Live logs** - See restart notifications in real-time

### Individual Services

#### API Server Only
```bash
cd server
docker-compose up --build
```

#### Converter Only
```bash
cd converter
docker build -t converter .
docker run -v $(pwd)/input:/app/input -v $(pwd)/output:/app/output converter
```

## 📡 API Endpoints

Once the API server is running, you can use these endpoints:

### Health Check
```bash
curl http://localhost:3000/health
```

### Get Available Idols
```bash
curl http://localhost:3000/idols
```

### Start Image Download
```bash
curl -X POST http://localhost:3000/download \
  -H "Content-Type: application/json" \
  -d '{"idolName": "jihyo", "start": 1, "end": 5}'
```

### Check Download Status
```bash
curl http://localhost:3000/downloads/jihyo
```

## 🎬 Video Conversion

The converter API provides multiple ways to convert WebP files:

### Using the API
```bash
# Upload and convert a single file
curl -X POST http://localhost:5000/convert \
  -F "file=@your_file.webp"

# Convert all files in input directory
curl -X POST http://localhost:5000/convert/batch

# List all files
curl http://localhost:5000/files

# Download converted file
curl -O http://localhost:5000/download/filename.mp4
```

### Using Docker (Legacy)
1. **Place WebP files** in `converter/input/`
2. **Run the converter:**
   ```bash
   docker-compose run cypress-pop-converter
   ```
3. **Find MP4 files** in `converter/output/`

## 📁 Project Structure

```
cypress-pop/
├── docker-compose.yml          # Root Docker Compose
├── .dockerignore              # Root Docker ignore rules
├── downloads/                  # Shared downloads folder
│   └── .gitkeep              # Git tracking
├── server/                     # API Server
│   ├── server.js              # Main API server
│   ├── package.json           # Node.js dependencies
│   ├── Dockerfile             # Server Docker config
│   ├── .dockerignore          # Server Docker ignore rules
│   └── README.md              # Server documentation
├── converter/                  # Video Converter
│   ├── app.py                 # Python converter script
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Converter Docker config
│   ├── .dockerignore          # Converter Docker ignore rules
│   ├── input/                 # WebP input files
│   │   └── .gitkeep          # Git tracking
│   └── output/                # MP4 output files
│       └── .gitkeep          # Git tracking
├── README.md                  # This file
├── QUICK_REFERENCE.md         # Quick commands
└── start.sh                   # Startup script
```

## 🔧 Development

### Local Development

#### API Server
```bash
cd server
npm install
npm start
```

#### Converter
```bash
cd converter
pip install -r requirements.txt
python app.py
```

### Testing

#### Test API
```bash
cd server
node test-api.js
```

#### Test Converter
```bash
# Place a WebP file in converter/input/
cd converter
python app.py
```

## 🐳 Docker Services

### cypress-pop-api
- **Port:** 3000
- **Purpose:** Downloads images using Puppeteer
- **Health Check:** `/health` endpoint
- **Volumes:** `./downloads` → `/app/downloads`

### cypress-pop-converter
- **Port:** 5000
- **Purpose:** Converts WebP to MP4 via Flask API
- **Health Check:** `/health` endpoint
- **Volumes:** 
  - `./downloads` → `/app/downloads`
  - `./converter/input` → `/app/input`
  - `./converter/output` → `/app/output`

## 📊 Usage Examples

### Complete Workflow

1. **Start services:**
   ```bash
   docker-compose up --build
   ```

2. **Download images:**
   ```bash
   curl -X POST http://localhost:3000/download \
     -H "Content-Type: application/json" \
     -d '{"idolName": "jihyo", "start": 1, "end": 3}'
   ```

3. **Convert WebP to MP4:**
   ```bash
   # Upload and convert single file
   curl -X POST http://localhost:5000/convert \
     -F "file=@your_file.webp"
   
   # Or convert all files in input directory
   curl -X POST http://localhost:5000/convert/batch
   ```

4. **Check results:**
   ```bash
   # Check downloaded images
   ls downloads/jihyo/
   
   # Check converted videos
   ls converter/output/
   
   # List files via API
   curl http://localhost:5000/files
   ```

## 🔍 Monitoring

### API Health
```bash
curl http://localhost:3000/health
```

### Docker Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs cypress-pop-api
docker-compose logs cypress-pop-converter
```

### Service Status
```bash
docker-compose ps
```

## 🛠️ Configuration

### Environment Variables

#### API Server
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode

#### Converter
- `INPUT_DIR`: Input directory (default: input)
- `OUTPUT_DIR`: Output directory (default: output)

### Volume Mounts

- `./downloads` → Shared downloads folder
- `./converter/input` → WebP input files
- `./converter/output` → MP4 output files

## 🚨 Troubleshooting

### Common Issues

1. **Port 3000 already in use:**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "3001:3000"
   ```

2. **Converter not finding files:**
   ```bash
   # Ensure files are in converter/input/
   ls converter/input/
   ```

3. **Docker build fails:**
   ```bash
   # Clean and rebuild
   docker-compose down
   docker-compose build --no-cache
   docker-compose up
   ```

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f cypress-pop-api
```

## 📝 Notes

- Downloads are saved to `./downloads/` directory
- WebP files should be placed in `./converter/input/`
- MP4 files will be created in `./converter/output/`
- Both services share the downloads directory
- The API server runs on port 3000 by default
- All services use the `cypress-pop-network` Docker network 