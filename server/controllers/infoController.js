import { config } from '../config/app.js';

// Get available idols
export function getAvailableIdols(req, res) {
  res.json({ idols: config.idols });
}

// Get available creators
export function getAvailableCreators(req, res) {
  res.json({ creators: config.creators });
}

// Health check
export function healthCheck(req, res) {
  res.json({ 
    status: 'OK', 
    message: 'Cypress Pop API is running',
    timestamp: new Date().toISOString()
  });
} 