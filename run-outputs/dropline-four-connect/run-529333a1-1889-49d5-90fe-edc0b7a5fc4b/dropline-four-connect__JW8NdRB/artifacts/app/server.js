const express = require('express');
const path = require('path');
const { getDb, DB_PATH } = require('./db');
const { router: authRouter } = require('./routes/auth');
const { router: gameRouter } = require('./routes/game');
const { router: analysisRouter } = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Ensure DB is initialized
getDb();

app.use(express.json());

// Request logging in development/testing if needed
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api', gameRouter);
app.use('/api', analysisRouter);

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`DropLine server running at http://${HOST}:${PORT}`);
  console.log(`Using SQLite database at: ${DB_PATH}`);
});

module.exports = { app, server };
