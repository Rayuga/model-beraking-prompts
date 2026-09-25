const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');

const authRoutes = require('./routes/auth');
const vacancyRoutes = require('./routes/vacancies');
const candidateRoutes = require('./routes/candidates');
const batchOfferRoutes = require('./routes/batchOffers');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Ensure DB is initialized
getDb();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple cookie parser for session token if sent via cookie
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [key, ...vals] = part.trim().split('=');
      if (key) {
        req.cookies[key] = decodeURIComponent(vals.join('='));
      }
    }
  }
  next();
});

// Disable caching for dynamic API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vacancies/:code/batch-offers', batchOfferRoutes);
app.use('/api/vacancies', vacancyRoutes);
app.use('/api/candidates', candidateRoutes);

// Static assets with explicit MIME types
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// SPA Fallback: serve index.html for non-API routes
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(indexPath);
  } else {
    return res.status(404).send('Not Found');
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Pellmoor Hiring Workspace server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
