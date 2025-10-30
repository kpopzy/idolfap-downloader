# Cypress Pop API Server

A REST API server that converts the main.js image downloader functionality into web endpoints.

## Features

- 🚀 REST API endpoints for image downloading
- 🐳 Docker support for easy deployment
- 📊 Health monitoring
- 📁 File management and status checking
- 🔄 Background processing

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and health information.

### Get Available Idols
```
GET /idols
```
Returns a list of available idol names for downloading.

### Get Available Creators
```
GET /creators
```
Returns a list of available creator names for downloading.

### Download Idol Images
```
POST /download
Content-Type: application/json

{
  "idolName": "jihyo",
  "start": 1,
  "end": 10
}
```
Starts downloading images for the specified idol from the given page range.

### Download Single Post
```
POST /download/single
Content-Type: application/json

{
  "postUrl": "https://idolfap.com/post/110673/"
}
```
Downloads all images from a specific post URL.

### Download Creator Posts
```
POST /download/creator
Content-Type: application/json

{
  "creatorName": "darkyeji"
}
```
Downloads all posts from a specific creator (automatically paginates through all pages).

### Check Download Status
```
GET /downloads/:idolName
```
Returns the status and file count for a specific idol's downloads.

## Running the API

### Using Docker (Recommended)

1. **Build and run with Docker Compose:**
   ```bash
   cd server
   docker-compose up --build
   ```

2. **Or build and run manually:**
   ```bash
   cd server
   docker build -t cypress-pop-api .
   docker run -p 3000:3000 -v $(pwd)/../downloads:/app/downloads cypress-pop-api
   ```

### Running Locally

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **For development with auto-restart:**
   ```bash
   npm run dev
   ```

## Usage Examples

### Using curl

1. **Check server health:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Get available idols:**
   ```bash
   curl http://localhost:3000/idols
   ```

3. **Get available creators:**
   ```bash
   curl http://localhost:3000/creators
   ```

4. **Start an idol download:**
   ```bash
   curl -X POST http://localhost:3000/download \
     -H "Content-Type: application/json" \
     -d '{"idolName": "jihyo", "start": 1, "end": 5}'
   ```

5. **Download a single post:**
   ```bash
   curl -X POST http://localhost:3000/download/single \
     -H "Content-Type: application/json" \
     -d '{"postUrl": "https://idolfap.com/post/110673/"}'
   ```

6. **Download creator posts:**
   ```bash
   curl -X POST http://localhost:3000/download/creator \
     -H "Content-Type: application/json" \
     -d '{"creatorName": "darkyeji"}'
   ```

7. **Check download status:**
   ```bash
   curl http://localhost:3000/downloads/jihyo
   ```

### Using JavaScript

```javascript
// Start a download
const response = await fetch('http://localhost:3000/download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    idolName: 'jihyo',
    start: 1,
    end: 10
  })
});

const result = await response.json();
console.log(result);
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Docker Configuration

The Docker setup includes:
- Node.js 18 Alpine base image
- Chromium browser for Puppeteer
- Health checks
- Volume mounting for downloads
- Automatic restart on failure

## File Structure

```
server/
├── server.js          # Main API server
├── package.json       # Dependencies
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose setup
└── README.md         # This file
```

## Notes

- Downloads are saved to the `../downloads/` directory
- The API runs on port 3000 by default
- Puppeteer runs in headless mode for server compatibility
- All endpoints support CORS for cross-origin requests 