import express from 'express';
import { getDownloadStatus } from '../controllers/statusController.js';

const router = express.Router();

// Get download status endpoint
router.get('/downloads/:idolName', getDownloadStatus);

export default router; 