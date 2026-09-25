const express = require('express');
const path = require('path');

const app = express();
const publicDir = path.join(__dirname, 'public');

app.use(express.json());
app.get('/api/health', (_request, response) => response.json({ ok: true }));
app.use(express.static(publicDir));
app.use((_request, response) => response.sendFile(path.join(publicDir, 'index.html')));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Common Ground starter listening on ${port}`));
