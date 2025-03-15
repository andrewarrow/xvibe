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
    origin: ["http://localhost:5173", "http://localhost:4173"], // Vite dev and preview ports
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

// Serve static files from videos directory (requires authentication)
app.use('/videos', authenticateToken, express.static(videosDir));

// Serve caption files through the API - no authentication for direct access
app.get('/api/captions/:uuid', (req, res) => {
  const { uuid } = req.params;
  
  // Get video info
  const video = db.prepare(`
    SELECT * FROM videos 
    WHERE directory_path LIKE ? AND captions_path IS NOT NULL
    LIMIT 1
  `).get(`%${uuid}%`);
  
  if (!video || !video.captions_path) {
    return res.status(404).json({ message: 'Captions not found' });
  }
  
  // Set CORS headers
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
  });
  
  // Check if file exists
  if (fs.existsSync(video.captions_path)) {
    // Set content type for WebVTT
    res.set('Content-Type', 'text/vtt');
    
    // Handle download parameter
    const download = req.query.download === 'true';
    if (download) {
      res.set('Content-Disposition', 'attachment; filename=captions.vtt');
    } else {
      res.set('Content-Disposition', 'inline');
    }
    
    // Send the file
    fs.createReadStream(video.captions_path).pipe(res);
  } else {
    res.status(404).send('Captions file not found');
  }
});

// Serve keyframe images through the API route to avoid conflicts with the frontend
app.get('/api/keyframe-images/:uuid/:filename', (req, res) => {
  // Set CORS headers for images to allow them to be loaded in the frontend
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
  });
  
  const { uuid, filename } = req.params;
  const imagePath = path.join(videosDir, uuid, 'keyframes', filename);
  
  console.log('Request for keyframe image:', imagePath);
  
  // Check if file exists
  if (fs.existsSync(imagePath)) {
    console.log('File exists, sending...');
    // Set the correct content type for JPG files
    res.set('Content-Type', 'image/jpeg');
    // Send the file with the correct headers
    fs.createReadStream(imagePath).pipe(res);
  } else {
    console.log('File not found:', imagePath);
    res.status(404).send('Image not found');
  }
});

// Debug route to list available keyframes
app.get('/api/debug/keyframes/:uuid', (req, res) => {
  const { uuid } = req.params;
  const keyframesPath = path.join(videosDir, uuid, 'keyframes');
  
  if (fs.existsSync(keyframesPath)) {
    const files = fs.readdirSync(keyframesPath)
      .filter(file => file.endsWith('.jpg'))
      .map(file => ({
        filename: file,
        url: `/api/keyframe-images/${uuid}/${file}`,
        path: path.join(keyframesPath, file)
      }));
    
    res.json({ 
      directory: keyframesPath,
      exists: true,
      fileCount: files.length,
      files: files
    });
  } else {
    res.json({ 
      directory: keyframesPath,
      exists: false,
      error: 'Directory not found'
    });
  }
});

// Middleware - enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'], // Vite dev and preview ports
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Download YouTube captions
app.post('/api/videos/:id/captions', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { youtubeId } = req.body;
  const userId = req.user.id;
  
  if (!youtubeId) {
    return res.status(400).json({ message: 'YouTube video ID is required' });
  }
  
  try {
    // Get video details
    const video = db.prepare(`
      SELECT * FROM videos 
      WHERE id = ? AND user_id = ?
    `).get(id, userId);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    console.log(`Fetching captions for YouTube ID: ${youtubeId}`);
    
    // Use yt-dlp to download captions
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const captionsPath = path.join(video.directory_path, 'captions.vtt');
    
    // Run yt-dlp with skip-download and write-sub options
    return new Promise((resolve, reject) => {
      const ytDlpProcess = exec(
        `yt-dlp --skip-download --write-auto-sub --sub-lang en "${videoUrl}" -o "${path.join(video.directory_path, 'captions')}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error running yt-dlp for captions: ${error.message}`);
            console.error(`stderr: ${stderr}`);
            return reject(new Error(`Failed to download captions: ${error.message}`));
          }
          
          console.log(`yt-dlp output: ${stdout}`);
          
          // Look for the downloaded caption file (yt-dlp will add the extension)
          const captionFiles = fs.readdirSync(video.directory_path)
            .filter(file => file.startsWith('captions.') && 
              (file.endsWith('.vtt') || file.endsWith('.srt') || 
               file.endsWith('.en.vtt') || file.endsWith('.en.srt')));
          
          if (captionFiles.length === 0) {
            return reject(new Error('No caption files found after download.'));
          }
          
          // Use the first caption file found
          const captionFile = captionFiles[0];
          const fullCaptionPath = path.join(video.directory_path, captionFile);
          
          // Rename to captions.vtt if needed
          if (captionFile !== 'captions.vtt') {
            try {
              // Read the content
              const captionContent = fs.readFileSync(fullCaptionPath, 'utf8');
              
              // Write to captions.vtt
              fs.writeFileSync(captionsPath, captionContent);
              
              // Remove the original file
              fs.unlinkSync(fullCaptionPath);
              
              console.log(`Renamed caption file from ${captionFile} to captions.vtt`);
            } catch (renameError) {
              console.error(`Error renaming caption file: ${renameError.message}`);
              // Still continue with the original filename
              return reject(new Error(`Error processing caption file: ${renameError.message}`));
            }
          }
          
          // Update database with captions path
          db.prepare(`
            UPDATE videos 
            SET captions_path = ? 
            WHERE id = ?
          `).run(captionsPath, id);
          
          resolve();
        }
      );
      
      ytDlpProcess.stdout.on('data', (data) => {
        console.log(`yt-dlp stdout: ${data}`);
      });
      
      ytDlpProcess.stderr.on('data', (data) => {
        console.log(`yt-dlp stderr: ${data}`);
      });
    })
    .then(() => {
      res.json({ 
        message: 'Captions downloaded successfully',
        captionsPath
      });
    })
    .catch((error) => {
      throw error;
    });
    
  } catch (error) {
    console.error('Error downloading captions:', error);
    res.status(500).json({ message: `Error downloading captions: ${error.message}` });
  }
});

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
  const videoDir = path.join(videosDir, downloadId);
  
  // Create a directory for this video
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  
  db.prepare(`
    INSERT INTO videos 
    (user_id, original_url, status, filename, file_path, directory_path, download_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, url, 'started', 'pending', 'pending', videoDir, downloadId);
  
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

// Get single video details
app.get('/api/videos/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  try {
    // Get video details
    const video = db.prepare(`
      SELECT * FROM videos 
      WHERE id = ? AND user_id = ?
    `).get(id, userId);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Get keyframes for this video
    const keyframes = db.prepare(`
      SELECT * FROM keyframes 
      WHERE video_id = ? 
      ORDER BY filename
    `).all(id);
    
    // Get other versions of this video (based on directory path)
    const versions = db.prepare(`
      SELECT * FROM videos 
      WHERE directory_path = ? AND id != ? 
      ORDER BY created_at DESC
    `).all(video.directory_path, id);
    
    // Add extension info
    if (video.filename && video.filename !== 'pending') {
      const extMatch = video.filename.match(/\.([^.]+)$/);
      video.extension = extMatch ? extMatch[1] : 'unknown';
    } else {
      video.extension = 'unknown';
    }
    
    // Format keyframes for client
    const formattedKeyframes = keyframes.map(keyframe => ({
      ...keyframe,
      url: `/api/keyframe-images/${path.basename(video.directory_path)}/${keyframe.filename}`
    }));
    
    // Format versions
    const formattedVersions = versions.map(version => {
      const extMatch = version.filename.match(/\.([^.]+)$/);
      return {
        ...version,
        extension: extMatch ? extMatch[1] : 'unknown',
        url: `/videos/${path.basename(version.directory_path)}/${version.filename}`
      };
    });
    
    // Add video URL
    video.url = `/videos/${path.basename(video.directory_path)}/${video.filename}`;
    
    res.json({ 
      video, 
      keyframes: formattedKeyframes,
      versions: formattedVersions
    });
  } catch (error) {
    console.error('Error fetching video details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Extract keyframes from video
app.post('/api/videos/:id/keyframes', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { socketId } = req.body;
  const userId = req.user.id;
  
  try {
    // Get video details
    const video = db.prepare(`
      SELECT * FROM videos 
      WHERE id = ? AND user_id = ?
    `).get(id, userId);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.status !== 'completed') {
      return res.status(400).json({ message: 'Video is not ready for keyframe extraction' });
    }
    
    res.json({ message: 'Keyframe extraction started' });
    
    // Start keyframe extraction process
    extractKeyframes(video.file_path, video.directory_path, video.id, socketId);
  } catch (error) {
    console.error('Error starting keyframe extraction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Extract clip from video based on keyframe selection
app.post('/api/videos/:id/extract-clip', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, socketId } = req.body;
  const userId = req.user.id;
  
  if (startTime === undefined || endTime === undefined) {
    return res.status(400).json({ message: 'Start and end times are required' });
  }
  
  try {
    // Get video details
    const video = db.prepare(`
      SELECT * FROM videos 
      WHERE id = ? AND user_id = ?
    `).get(id, userId);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.status !== 'completed') {
      return res.status(400).json({ message: 'Video is not ready for clip extraction' });
    }
    
    // Generate clip ID and setup paths
    const clipId = uuidv4();
    const formattedStart = Math.floor(startTime);
    const formattedEnd = Math.ceil(endTime);
    const clipDuration = formattedEnd - formattedStart;
    
    const outputFilename = `clip_${formattedStart}_${formattedEnd}.mp4`;
    const outputPath = path.join(video.directory_path, outputFilename);
    
    // Create clip entry in database
    db.prepare(`
      INSERT INTO videos 
      (user_id, title, original_url, status, filename, file_path, directory_path, download_id, parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, 
      `${video.title} (Clip ${formattedStart}s-${formattedEnd}s)`, 
      video.original_url, 
      'converting', 
      outputFilename, 
      outputPath, 
      video.directory_path,
      clipId,
      video.id
    );
    
    res.json({ message: 'Clip extraction started', clipId });
    
    // Start the extraction process (defined below)
    extractClip(video.file_path, outputPath, formattedStart, clipDuration, clipId, socketId);
  } catch (error) {
    console.error('Error starting clip extraction:', error);
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
    const outputFilename = `converted.mp4`;
    const outputPath = path.join(video.directory_path, outputFilename);
    
    // Create conversion entry in database
    db.prepare(`
      INSERT INTO videos 
      (user_id, title, original_url, status, filename, file_path, directory_path, download_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, 
      `${video.title} (MP4)`, 
      video.original_url, 
      'converting', 
      outputFilename, 
      outputPath, 
      video.directory_path,
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
  
  // Create a directory for this video
  const videoDir = path.join(videosDir, downloadId);
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  
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
      const outputFilename = `original.${extension}`;
      const outputPath = path.join(videoDir, outputFilename);
      
      // Update filename and path in database
      db.prepare(`
        UPDATE videos 
        SET filename = ?, file_path = ?, directory_path = ? 
        WHERE download_id = ?
      `).run(outputFilename, outputPath, videoDir, downloadId);
      
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
            title: videoTitle,
            videoDir: downloadId // Send directory ID to client
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

// Function to extract keyframes from video
function extractKeyframes(videoPath, outputDir, videoId, socketId) {
  const socket = socketId ? io.to(socketId) : io;
  socket.emit('keyframe_status', { 
    id: videoId, 
    status: 'started',
    message: 'Keyframe extraction started...' 
  });
  
  // Create keyframes directory if it doesn't exist
  const keyframesDir = path.join(outputDir, 'keyframes');
  if (!fs.existsSync(keyframesDir)) {
    fs.mkdirSync(keyframesDir, { recursive: true });
  }
  
  // Use FFmpeg to extract keyframes (I-frames)
  const ffmpegCmd = `ffmpeg -i "${videoPath}" -vf "select=eq(pict_type\\,I)" -vsync vfr "${keyframesDir}/keyframe-%04d.jpg" -y`;
  
  const extractionProcess = exec(ffmpegCmd, (error) => {
    if (error) {
      console.error(`Error extracting keyframes: ${error.message}`);
      socket.emit('keyframe_status', { 
        id: videoId, 
        status: 'error',
        message: `Error extracting keyframes: ${error.message}` 
      });
      return;
    }
    
    // Get all keyframes
    fs.readdir(keyframesDir, (err, files) => {
      if (err) {
        console.error(`Error reading keyframes directory: ${err.message}`);
        socket.emit('keyframe_status', { 
          id: videoId, 
          status: 'error',
          message: `Error reading keyframes: ${err.message}` 
        });
        return;
      }
      
      // Filter only jpg files
      const keyframeFiles = files.filter(file => file.endsWith('.jpg'));
      
      // Insert keyframes into database
      keyframeFiles.forEach(filename => {
        const filePath = path.join(keyframesDir, filename);
        
        try {
          // Extract frame number from filename (keyframe-0001.jpg -> 1)
          const frameMatch = filename.match(/keyframe-(\d+)\.jpg/);
          const frameNumber = frameMatch ? parseInt(frameMatch[1], 10) : 0;
          
          db.prepare(`
            INSERT INTO keyframes 
            (video_id, filename, file_path) 
            VALUES (?, ?, ?)
          `).run(videoId, filename, filePath);
        } catch (error) {
          console.error(`Error saving keyframe to database: ${error.message}`);
        }
      });
      
      socket.emit('keyframe_status', { 
        id: videoId, 
        status: 'completed',
        message: 'Keyframe extraction complete!',
        keyframeCount: keyframeFiles.length,
        keyframes: keyframeFiles.map(file => `/api/keyframe-images/${path.basename(outputDir)}/${file}`)
      });
    });
  });
  
  // Monitor progress
  extractionProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(`Keyframe extraction stderr: ${output}`);
    
    // Try to parse progress
    const frameMatch = output.match(/frame=\s*(\d+)/);
    if (frameMatch && frameMatch[1]) {
      const frame = parseInt(frameMatch[1], 10);
      socket.emit('keyframe_progress', { 
        id: videoId, 
        frame,
        message: `Processed frame: ${frame}`
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

// Function to extract clip from video
function extractClip(inputPath, outputPath, startTime, duration, clipId, socketId) {
  const socket = socketId ? io.to(socketId) : io;
  socket.emit('conversion_status', { 
    id: clipId, 
    status: 'started',
    message: 'Clip extraction started...' 
  });
  
  // Format start time as HH:MM:SS
  const formatTimeForFFmpeg = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const ffmpegStartTime = formatTimeForFFmpeg(startTime);
  
  // Run FFmpeg for clip extraction
  const ffmpegCmd = `ffmpeg -ss ${ffmpegStartTime} -i "${inputPath}" -t ${duration} -c:v libx264 -c:a aac -strict experimental "${outputPath}" -y -progress pipe:1`;
  
  const extractionProcess = exec(ffmpegCmd, (error) => {
    if (error) {
      console.error(`Error extracting clip: ${error.message}`);
      updateVideoStatus(clipId, 'error');
      socket.emit('conversion_status', { 
        id: clipId, 
        status: 'error',
        message: `Error extracting clip: ${error.message}` 
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
      `).run('completed', fileSize, clipId);
      
      socket.emit('conversion_status', { 
        id: clipId, 
        status: 'completed',
        message: 'Clip extraction complete!',
        filename: path.basename(outputPath)
      });
    });
  });
  
  // Parse FFmpeg progress
  extractionProcess.stdout.on('data', (data) => {
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
      // Calculate progress percentage
      let percent = 0;
      
      if (duration) {
        const totalMs = duration * 1000;
        const currentMs = parseInt(progress.out_time_ms, 10);
        percent = Math.min(Math.round((currentMs / totalMs) * 100), 100);
      }
      
      const formattedTime = formatTime(progress.out_time);
      const message = `Extracting clip: ${formattedTime} / ${formatTimeForFFmpeg(duration)} (${percent}%)`;
      
      socket.emit('conversion_progress', { 
        id: clipId, 
        progress: percent,
        message,
        details: {
          currentTime: formattedTime,
          totalTime: formatTimeForFFmpeg(duration),
          bitrate: progress.bitrate || 'unknown',
          speed: progress.speed || '1x'
        }
      });
    }
  });
  
  extractionProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(`FFmpeg stderr: ${output}`);
  });
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
