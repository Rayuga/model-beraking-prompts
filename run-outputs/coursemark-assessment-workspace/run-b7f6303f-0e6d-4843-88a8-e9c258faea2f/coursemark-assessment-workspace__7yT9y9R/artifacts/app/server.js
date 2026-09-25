const express = require('express');
const path = require('path');
const { initializeDatabase, DB_PATH } = require('./src/db');
const { createRouter } = require('./src/routes');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Initialize DB and Seed
const db = initializeDatabase();

const app = express();

// Disable x-powered-by
app.disable('x-powered-by');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', createRouter(db));

// SPA fallback for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (req.method === 'GET') {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Coursemark server running on http://${HOST}:${PORT}`);
    console.log(`Database persisting to: ${DB_PATH}`);
  });
}

module.exports = { app, db };
