import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database.js';
import { sessionMiddleware } from './auth.js';
import authRoutes from './routes-auth.js';
import vacancyRoutes from './routes-vacancies.js';
import panelRoutes from './routes-panels.js';
import notesAndBatchRoutes from './routes-notes-and-batch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.dirname(__dirname);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(sessionMiddleware);

// Static files
app.use(express.static(path.join(appDir, 'public')));

// API routes
app.use(authRoutes);
app.use(vacancyRoutes);
app.use(panelRoutes);
app.use(notesAndBatchRoutes);

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(appDir, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`Database: ${process.env.DB_PATH || '/app/pellmoor.db'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
