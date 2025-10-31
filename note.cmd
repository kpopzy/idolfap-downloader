# Production mode
docker compose up --build

# Development mode with hot reloading
docker compose -f docker-compose.dev.yml up --build

docker build -t idol-downloader-api .
docker stop idol-api
docker rm idol-api
docker run --rm --name idol-api -p 5000:5000 idol-downloader-api

curl -X POST http://localhost:5000/download \
  -H 'Content-Type: application/json' \
  -d '{"idol":"winter","start":1,"end":2}'