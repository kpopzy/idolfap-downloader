import fs from 'fs';
import path from 'path';
import { getDownloadsDir } from '../utils/downloadUtils.js';

// Get download status for a specific idol
export function getDownloadStatus(req, res) {
  const { idolName } = req.params;
  const downloadDir = path.join(getDownloadsDir(), idolName);
  
  try {
    if (!fs.existsSync(downloadDir)) {
      return res.json({
        idolName,
        exists: false,
        files: [],
        count: 0
      });
    }

    const files = fs.readdirSync(downloadDir);
    res.json({
      idolName,
      exists: true,
      files,
      count: files.length
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
} 