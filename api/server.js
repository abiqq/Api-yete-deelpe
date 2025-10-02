const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const downloadDir = '/tmp/downloads';
const ytDlpPath = '/tmp/yt-dlp';

// Setup middleware
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(downloadDir));

// Create download directory
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// Helper function untuk validasi URL
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper function untuk eksekusi command
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'YT-DLP API Server is Running!',
    endpoints: {
      '/api/info?url=YOUTUBE_URL': 'Get video information',
      '/api/download/mp3?url=YOUTUBE_URL': 'Download as MP3',
      '/api/download/mp4?url=YOUTUBE_URL': 'Download as MP4'
    },
    note: 'This server is for educational purposes only'
  });
});

app.get('/api/info', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!isValidUrl(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    console.log('Getting info for:', videoUrl);
    const command = `"${ytDlpPath}" --dump-json --no-download "${videoUrl}"`;
    const stdout = await executeCommand(command);
    
    const info = JSON.parse(stdout);
    res.json({
      title: info.title,
      duration: info.duration_string,
      uploader: info.uploader,
      view_count: info.view_count,
      thumbnail: info.thumbnail,
      description: info.description ? info.description.substring(0, 200) + '...' : ''
    });

  } catch (error) {
    console.error('Info error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/mp3', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    const quality = req.query.quality || '320';
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!isValidUrl(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    console.log('Downloading MP3:', videoUrl);
    const timestamp = Date.now();
    const outputTemplate = path.join(downloadDir, `audio_${timestamp}.%(ext)s`);
    
    const command = `"${ytDlpPath}" -x --audio-format mp3 --audio-quality ${quality} -o "${outputTemplate}" "${videoUrl}"`;
    await executeCommand(command);

    // Cari file yang baru dibuat
    const files = fs.readdirSync(downloadDir);
    const downloadedFile = files.find(file => file.includes(timestamp.toString()));
    
    if (downloadedFile) {
      const filepath = path.join(downloadDir, downloadedFile);
      
      // Set header untuk download
      res.setHeader('Content-Disposition', `attachment; filename="${downloadedFile}"`);
      res.download(filepath, downloadedFile, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Cleanup file setelah download
        setTimeout(() => {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        }, 5000);
      });
    } else {
      throw new Error('Downloaded file not found');
    }

  } catch (error) {
    console.error('MP3 download error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/mp4', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    const quality = req.query.quality || 'best';
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!isValidUrl(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    console.log('Downloading MP4:', videoUrl);
    const timestamp = Date.now();
    const outputTemplate = path.join(downloadDir, `video_${timestamp}.%(ext)s`);
    
    let command;
    if (quality === 'best') {
      command = `"${ytDlpPath}" -f "best[ext=mp4]" -o "${outputTemplate}" "${videoUrl}"`;
    } else {
      command = `"${ytDlpPath}" -f "best[height<=${quality}]" -o "${outputTemplate}" "${videoUrl}"`;
    }

    await executeCommand(command);

    // Cari file yang baru dibuat
    const files = fs.readdirSync(downloadDir);
    const downloadedFile = files.find(file => file.includes(timestamp.toString()));
    
    if (downloadedFile) {
      const filepath = path.join(downloadDir, downloadedFile);
      
      // Set header untuk download
      res.setHeader('Content-Disposition', `attachment; filename="${downloadedFile}"`);
      res.download(filepath, downloadedFile, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Cleanup file setelah download
        setTimeout(() => {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        }, 5000);
      });
    } else {
      throw new Error('Downloaded file not found');
    }

  } catch (error) {
    console.error('MP4 download error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(downloadDir)
      .map(file => {
        const filepath = path.join(downloadDir, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          created: stats.birthtime,
          download_url: `/downloads/${file}`
        };
      });
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export untuk Vercel
module.exports = app;

// Jika dijalankan langsung (development)
if (require.main === module) {
  app.listen(port, () => {
    console.log('🎵 YT-DLP API Server Started!');
    console.log(`📍 Port: ${port}`);
  });
}