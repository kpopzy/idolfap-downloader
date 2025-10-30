import express from 'express';
import cors from 'cors';
import infoRoutes from './routes/infoRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import testRoutes from './routes/testRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', infoRoutes);
app.use('/', downloadRoutes);
app.use('/', statusRoutes);
app.use('/', testRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Cypress Pop API server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`📥 Download endpoints:`);
  logger.info(`   - POST http://localhost:${PORT}/download (idols)`);
  logger.info(`   - POST http://localhost:${PORT}/download/single (single post)`);
  logger.info(`   - POST http://localhost:${PORT}/download/creator (creators)`);
  logger.info(`📋 Lists: GET http://localhost:${PORT}/idols, /creators`);
  logger.info(`📊 Status: GET http://localhost:${PORT}/downloads/:idolName`);
  logger.info(`🧪 Test: GET http://localhost:${PORT}/test/browser`);
  logger.info(`🧪 Test: GET http://localhost:${PORT}/test/browser-simple`);
  logger.info(`🧪 Test: GET http://localhost:${PORT}/test/browser-ultra-simple`);
  logger.info(`🧪 Test: GET http://localhost:${PORT}/test/browser-alternative`);
}); 