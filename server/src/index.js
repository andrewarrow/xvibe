import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
app.post('/api/download-video', (req, res) => {
  const { url, socketId } = req.body;
  
  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }
  
  // Validate YouTube URL
  const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  if (!youtubeUrlPattern.test(url)) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }
  
  const downloadId = uuidv4();
  res.json({ message: 'Download started', downloadId });
  
  // Start the download process
  downloadYouTubeVideo(url, downloadId, socketId);
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
function downloadYouTubeVideo(url, downloadId, socketId) {
  const socket = socketId ? io.to(socketId) : io;
  socket.emit('download_status', { 
    id: downloadId, 
    status: 'started',
    message: 'Download started...' 
  });
  
  // Use yt-dlp to get file info first to determine extension
  exec(`yt-dlp --print filename -o "%(ext)s" ${url}`, (error, stdout) => {
    if (error) {
      console.error(`Error getting video info: ${error.message}`);
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
    
    // Download the video
    const downloadProcess = exec(`yt-dlp -o "${outputPath}" ${url}`, (error) => {
      if (error) {
        console.error(`Error downloading video: ${error.message}`);
        socket.emit('download_status', { 
          id: downloadId, 
          status: 'error',
          message: `Error downloading video: ${error.message}` 
        });
        return;
      }
      
      socket.emit('download_status', { 
        id: downloadId, 
        status: 'completed',
        message: 'Download complete!',
        filename: outputFilename
      });
    });
    
    // Monitor download progress (basic implementation)
    downloadProcess.stderr.on('data', (data) => {
      const progressMatch = data.toString().match(/(\d+\.\d+)%/);
      if (progressMatch && progressMatch[1]) {
        const progress = parseFloat(progressMatch[1]);
        socket.emit('download_progress', { 
          id: downloadId, 
          progress,
          message: `Downloaded ${progress}%` 
        });
      }
    });
  });
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});