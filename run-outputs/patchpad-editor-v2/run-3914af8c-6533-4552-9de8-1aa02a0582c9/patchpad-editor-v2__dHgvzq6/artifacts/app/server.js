const express = require('express');
const path = require('path');
const apiRoutes = require('./src/routes');
const { getDb } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Initialize DB on startup
getDb();

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API routes
app.use('/api', apiRoutes);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for single page app routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

const server = app.listen(PORT, HOST, () => {
  console.log(`PatchPad editor listening on http://${HOST}:${PORT}`);
});

module.exports = { app, server };
