import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from './db.js';
import db from './db.js';
import authRoutes from './routes/auth.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from './middleware/auth.js';

// Initialize database
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite default dev server port
    methods: ["GET", "POST"]
  }
});

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const videosDir = path.join(__dirname, '../../videos');

// Ensure videos directory exists
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// YouTube download endpoint
app.post('/api/download-video', authenticateToken, (req, res) => {
  const { url, socketId } = req.body;
  const userId = req.user.id;
  
  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }
  
  // Validate YouTube URL
  const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  if (!youtubeUrlPattern.test(url)) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }
  
  const downloadId = uuidv4();
  
  // Create video entry in database with initial status
  db.prepare(`
    INSERT INTO videos 
    (user_id, original_url, status, filename, file_path, download_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, url, 'started', 'pending', 'pending', downloadId);
  
  res.json({ message: 'Download started', downloadId });
  
  // Start the download process
  downloadYouTubeVideo(url, downloadId, socketId, userId);
});

// Get user's video history
app.get('/api/videos', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  try {
    const videos = db.prepare(`
      SELECT * FROM videos 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
    
    // Add file extension info to each video
    videos.forEach(video => {
      if (video.filename && video.filename !== 'pending') {
        const extMatch = video.filename.match(/\.([^.]+)$/);
        video.extension = extMatch ? extMatch[1] : 'unknown';
      } else {
        video.extension = 'unknown';
      }
    });
    
    res.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Convert video to MP4
app.post('/api/convert-video', authenticateToken, (req, res) => {
  const { videoId, socketId } = req.body;
  const userId = req.user.id;
  
  if (!videoId) {
    return res.status(400).json({ message: 'Video ID is required' });
  }
  
  // Get video info from database
  try {
    const video = db.prepare(`
      SELECT * FROM videos 
      WHERE id = ? AND user_id = ?
    `).get(videoId, userId);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.status !== 'completed') {
      return res.status(400).json({ message: 'Video is not ready for conversion' });
    }
    
    const convertId = uuidv4();
    const outputFilename = `${convertId}.mp4`;
    const outputPath = path.join(videosDir, outputFilename);
    
    // Create conversion entry in database
    db.prepare(`
      INSERT INTO videos 
      (user_id, title, original_url, status, filename, file_path, download_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, 
      `${video.title} (MP4)`, 
      video.original_url, 
      'converting', 
      outputFilename, 
      outputPath, 
      convertId
    );
    
    res.json({ message: 'Conversion started', convertId });
    
    // Start the conversion process
    convertVideoToMp4(video.file_path, outputPath, convertId, socketId);
  } catch (error) {
    console.error('Error starting conversion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A client connected', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Function to download YouTube video
function downloadYouTubeVideo(url, downloadId, socketId, userId) {
  const socket = socketId ? io.to(socketId) : io;
  socket.emit('download_status', { 
    id: downloadId, 
    status: 'started',
    message: 'Download started...' 
  });
  
  // Use yt-dlp to get video info first
  exec(`yt-dlp --print "%(title)s" ${url}`, (error, titleStdout) => {
    if (error) {
      console.error(`Error getting video title: ${error.message}`);
      updateVideoStatus(downloadId, 'error', `Error getting video info: ${error.message}`);
      socket.emit('download_status', { 
        id: downloadId, 
        status: 'error',
        message: `Error getting video info: ${error.message}` 
      });
      return;
    }
    
    const videoTitle = titleStdout.trim();
    
    // Update video title in database
    db.prepare(`
      UPDATE videos 
      SET title = ? 
      WHERE download_id = ?
    `).run(videoTitle, downloadId);
    
    // Get file extension
    exec(`yt-dlp --print filename -o "%(ext)s" ${url}`, (error, stdout) => {
      if (error) {
        console.error(`Error getting video info: ${error.message}`);
        updateVideoStatus(downloadId, 'error', `Error getting video info: ${error.message}`);
        socket.emit('download_status', { 
          id: downloadId, 
          status: 'error',
          message: `Error getting video info: ${error.message}` 
        });
        return;
      }
      
      const extension = stdout.trim();
      const outputFilename = `${downloadId}.${extension}`;
      const outputPath = path.join(videosDir, outputFilename);
      
      // Update filename and path in database
      db.prepare(`
        UPDATE videos 
        SET filename = ?, file_path = ? 
        WHERE download_id = ?
      `).run(outputFilename, outputPath, downloadId);
      
      // Download the video
      const downloadProcess = exec(`yt-dlp -o "${outputPath}" ${url}`, (error) => {
        if (error) {
          console.error(`Error downloading video: ${error.message}`);
          updateVideoStatus(downloadId, 'error', `Error downloading video: ${error.message}`);
          socket.emit('download_status', { 
            id: downloadId, 
            status: 'error',
            message: `Error downloading video: ${error.message}` 
          });
          return;
        }
        
        // Get file size
        fs.stat(outputPath, (err, stats) => {
          const fileSize = err ? 0 : stats.size;
          
          // Update video status to completed
          db.prepare(`
            UPDATE videos 
            SET status = ?, file_size = ? 
            WHERE download_id = ?
          `).run('completed', fileSize, downloadId);
          
          socket.emit('download_status', { 
            id: downloadId, 
            status: 'completed',
            message: 'Download complete!',
            filename: outputFilename,
            title: videoTitle
          });
        });
      });
      
      // Monitor download progress - capture stdout and stderr
      downloadProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`stdout: ${output}`);
        
        // Parse progress information
        const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+([0-9.]+)(K|M|G)iB\s+at\s+([0-9.]+)(K|M|G)iB\/s\s+ETA\s+(\d+:\d+)/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          const fileSize = `${progressMatch[2]}${progressMatch[3]}iB`;
          const speed = `${progressMatch[4]}${progressMatch[5]}iB/s`;
          const eta = progressMatch[6];
          
          socket.emit('download_progress', { 
            id: downloadId, 
            progress,
            message: `[download] ${progress}% of ${fileSize} at ${speed} ETA ${eta}`,
            details: {
              fileSize,
              speed,
              eta
            }
          });
        }
      });
      
      downloadProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`stderr: ${output}`);
        
        // Also try to parse progress from stderr as some versions output there
        const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+([0-9.]+)(K|M|G)iB\s+at\s+([0-9.]+)(K|M|G)iB\/s\s+ETA\s+(\d+:\d+)/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          const fileSize = `${progressMatch[2]}${progressMatch[3]}iB`;
          const speed = `${progressMatch[4]}${progressMatch[5]}iB/s`;
          const eta = progressMatch[6];
          
          socket.emit('download_progress', { 
            id: downloadId, 
            progress,
            message: `[download] ${progress}% of ${fileSize} at ${speed} ETA ${eta}`,
            details: {
              fileSize,
              speed,
              eta
            }
          });
        } else {
          // Fallback to basic progress pattern
          const basicProgressMatch = output.match(/(\d+\.\d+)%/);
          if (basicProgressMatch && basicProgressMatch[1]) {
            const progress = parseFloat(basicProgressMatch[1]);
            socket.emit('download_progress', { 
              id: downloadId, 
              progress,
              message: `Downloaded ${progress}%` 
            });
          }
        }
      });
    });
  });
}

// Function to convert video to MP4 using FFmpeg
function convertVideoToMp4(inputPath, outputPath, convertId, socketId) {
  const socket = socketId ? io.to(socketId) : io;
  socket.emit('conversion_status', { 
    id: convertId, 
    status: 'started',
    message: 'Conversion started...' 
  });
  
  // Run FFmpeg for conversion
  const ffmpegCmd = `ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -strict experimental "${outputPath}" -y -progress pipe:1`;
  
  const conversionProcess = exec(ffmpegCmd, (error) => {
    if (error) {
      console.error(`Error converting video: ${error.message}`);
      updateVideoStatus(convertId, 'error');
      socket.emit('conversion_status', { 
        id: convertId, 
        status: 'error',
        message: `Error converting video: ${error.message}` 
      });
      return;
    }
    
    // Update file size
    fs.stat(outputPath, (err, stats) => {
      const fileSize = err ? 0 : stats.size;
      
      // Update video status to completed
      db.prepare(`
        UPDATE videos 
        SET status = ?, file_size = ? 
        WHERE download_id = ?
      `).run('completed', fileSize, convertId);
      
      socket.emit('conversion_status', { 
        id: convertId, 
        status: 'completed',
        message: 'Conversion complete!',
        filename: path.basename(outputPath)
      });
    });
  });
  
  // Parse FFmpeg progress
  conversionProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`FFmpeg stdout: ${output}`);
    
    // Extract progress info
    let progress = {};
    output.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        progress[key.trim()] = value.trim();
      }
    });
    
    if (progress.out_time_ms && progress.total_size) {
      // Calculate progress percentage if duration is available
      let percent = 0;
      
      if (progress.duration) {
        const totalMs = timeToMs(progress.duration);
        const currentMs = parseInt(progress.out_time_ms, 10);
        percent = Math.min(Math.round((currentMs / totalMs) * 100), 100);
      }
      
      const formattedTime = formatTime(progress.out_time);
      const message = `Converting: ${formattedTime} / ${progress.duration || 'unknown'} (${percent}%)`;
      
      socket.emit('conversion_progress', { 
        id: convertId, 
        progress: percent,
        message,
        details: {
          currentTime: formattedTime,
          totalTime: progress.duration || 'unknown',
          bitrate: progress.bitrate || 'unknown',
          speed: progress.speed || '1x'
        }
      });
    }
  });
  
  conversionProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(`FFmpeg stderr: ${output}`);
    
    // Try to extract duration info from stderr
    const durationMatch = output.match(/Duration: ([0-9:.]+)/);
    if (durationMatch && durationMatch[1]) {
      socket.emit('conversion_info', { 
        id: convertId, 
        duration: durationMatch[1]
      });
    }
  });
}

// Helper function to format time
function formatTime(timeStr) {
  if (!timeStr) return '00:00:00';
  return timeStr.split('.')[0]; // Remove microseconds
}

// Helper function to convert time string to milliseconds
function timeToMs(timeStr) {
  if (!timeStr) return 0;
  
  const parts = timeStr.split(':').map(parseFloat);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
}

// Helper function to update video status in database
function updateVideoStatus(downloadId, status, message) {
  try {
    db.prepare(`
      UPDATE videos 
      SET status = ? 
      WHERE download_id = ?
    `).run(status, downloadId);
  } catch (error) {
    console.error('Error updating video status:', error);
  }
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});