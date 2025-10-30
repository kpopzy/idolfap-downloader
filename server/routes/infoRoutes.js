import express from 'express';
import { healthCheck, getAvailableIdols, getAvailableCreators } from '../controllers/infoController.js';

const router = express.Router();

// Health check endpoint
router.get('/health', healthCheck);

// Get available idols endpoint
router.get('/idols', getAvailableIdols);

// Get available creators endpoint
router.get('/creators', getAvailableCreators);

export default router; 