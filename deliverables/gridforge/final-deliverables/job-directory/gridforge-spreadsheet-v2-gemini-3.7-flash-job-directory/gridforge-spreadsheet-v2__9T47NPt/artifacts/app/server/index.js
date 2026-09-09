const http = require('http');
const path = require('path');
const express = require('express');
const { initDatabase, StorageEngine, DB_PATH } = require('./db');
const { createApiRouter } = require('./routes');
const { WebSocketManager } = require('./ws');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// Initialize Database
const db = initDatabase();
const storageEngine = new StorageEngine(db);

// Initialize Express App
const app = express();
const wsManager = new WebSocketManager(storageEngine);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets from /app/public
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api', createApiRouter(storageEngine, wsManager));

// Fallback to index.html for root or SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Create HTTP Server
const server = http.createServer(app);

// Attach WebSocket Server
wsManager.attach(server);

// Start listening
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`GridForge server running at http://${HOST}:${PORT}`);
    console.log(`SQLite database located at: ${DB_PATH}`);
  });
}

module.exports = { app, server, storageEngine, wsManager };
