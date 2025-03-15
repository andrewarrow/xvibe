import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

// Initialize database with tables
export const initializeDatabase = () => {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create videos table (migration 1)
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      filename TEXT NOT NULL,
      original_url TEXT NOT NULL,
      status TEXT NOT NULL,
      file_path TEXT NOT NULL,
      directory_path TEXT NOT NULL,
      file_size INTEGER,
      download_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // Create keyframes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keyframes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      timestamp TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES videos(id)
    )
  `);

  // Check if test user exists
  const testUser = db.prepare('SELECT * FROM users WHERE username = ?').get('andrewarrow');
  
  // If test user doesn't exist, create it
  if (!testUser) {
    const hashedPassword = bcrypt.hashSync('testing', 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('andrewarrow', hashedPassword);
    console.log('Test user created: andrewarrow');
  }
};

export default db;
