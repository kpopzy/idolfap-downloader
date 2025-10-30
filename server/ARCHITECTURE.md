# 🏗️ Server Architecture

This document describes the modular architecture of the Cypress Pop API server.

## 📁 Directory Structure

```
server/
├── config/
│   └── app.js                 # Application configuration
├── controllers/
│   ├── downloadController.js   # Download business logic
│   ├── infoController.js       # Static data controllers
│   └── statusController.js     # Status checking logic
├── middleware/
│   ├── errorHandler.js         # Error handling middleware
│   └── validation.js           # Request validation
├── routes/
│   ├── downloadRoutes.js       # Download endpoints
│   ├── infoRoutes.js          # Info endpoints
│   └── statusRoutes.js        # Status endpoints
├── utils/
│   └── downloadUtils.js        # Shared download utilities
├── server.js                   # Main application entry point
└── README.md                   # API documentation
```

## 🔧 Architecture Components

### 1. **Configuration** (`config/`)
- **`app.js`**: Centralized configuration for the application
  - Port and environment settings
  - Available idols and creators lists
  - Puppeteer browser settings
  - Download timeout configurations

### 2. **Controllers** (`controllers/`)
- **`downloadController.js`**: Core download functionality
  - `downloadIdolImages()`: Download images for specific idols
  - `downloadSinglePost()`: Download from a single post URL
  - `downloadCreatorPosts()`: Download all posts from a creator
- **`infoController.js`**: Static data endpoints
  - `getAvailableIdols()`: Return list of available idols
  - `getAvailableCreators()`: Return list of available creators
  - `healthCheck()`: Server health status
- **`statusController.js`**: Status checking
  - `getDownloadStatus()`: Check download status for idols

### 3. **Routes** (`routes/`)
- **`downloadRoutes.js`**: Download API endpoints
  - `POST /download`: Idol image downloads
  - `POST /download/single`: Single post downloads
  - `POST /download/creator`: Creator downloads
- **`infoRoutes.js`**: Information endpoints
  - `GET /health`: Health check
  - `GET /idols`: Available idols
  - `GET /creators`: Available creators
- **`statusRoutes.js`**: Status endpoints
  - `GET /downloads/:idolName`: Download status

### 4. **Middleware** (`middleware/`)
- **`errorHandler.js`**: Global error handling
  - Centralized error processing
  - Consistent error response format
  - 404 handler for unknown routes
- **`validation.js`**: Request validation
  - `validateIdolDownload()`: Validate idol download requests
  - `validateSinglePostDownload()`: Validate single post requests
  - `validateCreatorDownload()`: Validate creator requests

### 5. **Utilities** (`utils/`)
- **`downloadUtils.js`**: Shared download functions
  - `downloadImagesFromPost()`: Extract and download images from posts
  - `launchBrowser()`: Launch Puppeteer browser with config
  - `getDownloadsDir()`: Get downloads directory path
  - `ensureDirectory()`: Create directory if it doesn't exist

## 🔄 Data Flow

### Download Request Flow:
1. **Route** receives HTTP request
2. **Validation Middleware** validates request parameters
3. **Controller** processes business logic
4. **Utils** handle shared operations (browser, file operations)
5. **Response** returned to client

### Error Handling Flow:
1. **Validation** catches invalid requests early
2. **Controller** handles business logic errors
3. **Error Middleware** formats all errors consistently
4. **Client** receives standardized error response

## 🎯 Benefits of This Architecture

### **Separation of Concerns**
- Routes handle HTTP concerns
- Controllers handle business logic
- Utils handle shared operations
- Middleware handles cross-cutting concerns

### **Maintainability**
- Easy to add new endpoints
- Easy to modify business logic
- Easy to change validation rules
- Easy to update configuration

### **Testability**
- Controllers can be unit tested
- Utils can be unit tested
- Middleware can be unit tested
- Routes can be integration tested

### **Scalability**
- Easy to add new download types
- Easy to add new validation rules
- Easy to add new error handling
- Easy to add new configuration options

## 🔧 Adding New Features

### Adding a New Download Type:
1. Add function to `downloadController.js`
2. Add route to appropriate route file
3. Add validation to `validation.js`
4. Update configuration if needed

### Adding New Validation:
1. Add validation function to `validation.js`
2. Apply to route in route file
3. Test with invalid requests

### Adding New Configuration:
1. Add to `config/app.js`
2. Import in relevant files
3. Use throughout application

## 📊 Code Organization Principles

- **Single Responsibility**: Each file has one clear purpose
- **Dependency Injection**: Dependencies are passed in, not created
- **Configuration Driven**: Settings are centralized in config
- **Error First**: Errors are handled consistently
- **Validation First**: Requests are validated before processing 