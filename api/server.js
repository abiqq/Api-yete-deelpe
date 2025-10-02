const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

class YTDLPServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.downloadDir = '/tmp/downloads';
    this.ytDlpPath = '/tmp/yt-dlp'; // ⬅️ PATH YANG SAMA DENGAN BUILD SCRIPT
    
    this.setupMiddleware();
    this.setupRoutes();
    this.createDownloadDir();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use('/downloads', express.static(this.downloadDir));
  }

  createDownloadDir() {
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({
        message: 'YT-DLP API Server is Running!',
        endpoints: {
          '/api/info?url=YOUTUBE_URL': 'Get video information',
          '/api/download/mp3?url=YOUTUBE_URL': 'Download as MP3',
          '/api/download/mp4?url=YOUTUBE_URL': 'Download as MP4',
          '/api/files': 'List downloaded files'
        },
        note: 'This server is for educational purposes only'
      });
    });

    this.app.get('/api/info', async (req, res) => {
      try {
        const videoUrl = req.query.url;
        if (!videoUrl) {
          return res.status(400).json({ error: 'URL parameter is required' });
        }

        if (!this.isValidUrl(videoUrl)) {
          return res.status(400).json({ error: 'Invalid URL' });
        }

        console.log('Getting info for:', videoUrl);
        const info = await this.getVideoInfo(videoUrl);
        res.json(info);
      } catch (error) {
        console.error('Info error:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/download/mp3', async (req, res) => {
      try {
        const videoUrl = req.query.url;
        const quality = req.query.quality || '320';
        
        if (!videoUrl) {
          return res.status(400).json({ error: 'URL parameter is required' });
        }

        if (!this.isValidUrl(videoUrl)) {
          return res.status(400).json({ error: 'Invalid URL' });
        }

        console.log('Downloading MP3:', videoUrl);
        const result = await this.downloadAudio(videoUrl, 'mp3', quality);
        
        // Set header untuk download
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.download(result.filepath, result.filename, (err) => {
          if (err) {
            console.error('Download error:', err);
          }
          // Cleanup file setelah download
          setTimeout(() => {
            if (fs.existsSync(result.filepath)) {
              fs.unlinkSync(result.filepath);
            }
          }, 5000);
        });
      } catch (error) {
        console.error('MP3 download error:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/download/mp4', async (req, res) => {
      try {
        const videoUrl = req.query.url;
        const quality = req.query.quality || 'best';
        
        if (!videoUrl) {
          return res.status(400).json({ error: 'URL parameter is required' });
        }

        if (!this.isValidUrl(videoUrl)) {
          return res.status(400).json({ error: 'Invalid URL' });
        }

        console.log('Downloading MP4:', videoUrl);
        const result = await this.downloadVideo(videoUrl, 'mp4', quality);
        
        // Set header untuk download
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.download(result.filepath, result.filename, (err) => {
          if (err) {
            console.error('Download error:', err);
          }
          // Cleanup file setelah download
          setTimeout(() => {
            if (fs.existsSync(result.filepath)) {
              fs.unlinkSync(result.filepath);
            }
          }, 5000);
        });
      } catch (error) {
        console.error('MP4 download error:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/files', (req, res) => {
      try {
        const files = fs.readdirSync(this.downloadDir)
          .map(file => {
            const filepath = path.join(this.downloadDir, file);
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

    this.app.delete('/api/files/:filename', (req, res) => {
      try {
        const filename = req.params.filename;
        const filepath = path.join(this.downloadDir, filename);
        
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          res.json({ message: 'File deleted successfully' });
        } else {
          res.status(404).json({ error: 'File not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  getVideoInfo(videoUrl) {
    return new Promise((resolve, reject) => {
      // ⬇️ GUNAKAN this.ytDlpPath
      const command = `"${this.ytDlpPath}" --dump-json --no-download "${videoUrl}"`;
      
      console.log('Executing:', command);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`yt-dlp error: ${error.message}`));
          return;
        }

        try {
          const info = JSON.parse(stdout);
          resolve({
            title: info.title,
            duration: info.duration_string,
            uploader: info.uploader,
            view_count: info.view_count,
            thumbnail: info.thumbnail,
            description: info.description ? info.description.substring(0, 200) + '...' : '',
            formats: info.formats ? info.formats.slice(0, 10).map(f => ({
              format_id: f.format_id,
              ext: f.ext,
              quality: f.format_note,
              filesize: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'
            })) : []
          });
        } catch (parseError) {
          reject(new Error('Failed to parse video info'));
        }
      });
    });
  }

  downloadAudio(videoUrl, format = 'mp3', quality = '320') {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const outputTemplate = path.join(this.downloadDir, `%(title)s_${timestamp}.%(ext)s`);
      
      let command;
      if (format === 'mp3') {
        // ⬇️ GUNAKAN this.ytDlpPath
        command = `"${this.ytDlpPath}" -x --audio-format mp3 --audio-quality ${quality} -o "${outputTemplate}" "${videoUrl}"`;
      } else {
        command = `"${this.ytDlpPath}" -x --audio-format ${format} -o "${outputTemplate}" "${videoUrl}"`;
      }

      console.log('Executing:', command);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Download error details:', { error, stderr });
          reject(new Error(`Download failed: ${stderr || error.message}`));
          return;
        }

        const files = fs.readdirSync(this.downloadDir);
        const downloadedFile = files.find(file => file.includes(timestamp.toString()));
        
        if (downloadedFile) {
          const filepath = path.join(this.downloadDir, downloadedFile);
          const stats = fs.statSync(filepath);
          const downloadUrl = `/downloads/${downloadedFile}`;
          
          resolve({
            success: true,
            filename: downloadedFile,
            filepath: filepath,
            download_url: downloadUrl,
            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            format: format,
            quality: quality
          });
        } else {
          console.error('Available files:', files);
          reject(new Error('Downloaded file not found'));
        }
      });
    });
  }

  downloadVideo(videoUrl, format = 'mp4', quality = 'best') {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const outputTemplate = path.join(this.downloadDir, `%(title)s_${timestamp}.%(ext)s`);
      
      let command;
      if (quality === 'best') {
        // ⬇️ GUNAKAN this.ytDlpPath
        command = `"${this.ytDlpPath}" -f "best[ext=${format}]" -o "${outputTemplate}" "${videoUrl}"`;
      } else {
        command = `"${this.ytDlpPath}" -f "best[height<=${quality}]" -o "${outputTemplate}" "${videoUrl}"`;
      }

      console.log('Executing:', command);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Download error details:', { error, stderr });
          reject(new Error(`Download failed: ${stderr || error.message}`));
          return;
        }

        const files = fs.readdirSync(this.downloadDir);
        const downloadedFile = files.find(file => file.includes(timestamp.toString()));
        
        if (downloadedFile) {
          const filepath = path.join(this.downloadDir, downloadedFile);
          const stats = fs.statSync(filepath);
          const downloadUrl = `/downloads/${downloadedFile}`;
          
          resolve({
            success: true,
            filename: downloadedFile,
            filepath: filepath,
            download_url: downloadUrl,
            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            format: format,
            quality: quality
          });
        } else {
          console.error('Available files:', files);
          reject(new Error('Downloaded file not found'));
        }
      });
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log('🎵 YT-DLP API Server Started!');
      console.log(`📍 Port: ${this.port}`);
      console.log(`📁 Download Directory: ${path.resolve(this.downloadDir)}`);
      console.log(`🔧 yt-dlp Path: ${this.ytDlpPath}`);
      console.log('\n🌐 Available Endpoints:');
      console.log('   GET  /api/info?url=YOUTUBE_URL');
      console.log('   GET  /api/download/mp3?url=YOUTUBE_URL');
      console.log('   GET  /api/download/mp4?url=YOUTUBE_URL');
      console.log('   GET  /api/files');
      console.log('   DEL  /api/files/:filename');
    });
  }
}

// Export untuk Vercel
const server = new YTDLPServer();
module.exports = server.app;

// Jika dijalankan langsung (development)
if (require.main === module) {
  server.start();
}