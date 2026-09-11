const fs = require('fs');
const path = require('path');

function loadSeedData() {
  const seedPaths = [
    path.resolve('/assets/incident_seed.json'),
    path.resolve(__dirname, '../assets/incident_seed.json'),
    path.resolve(__dirname, './incident_seed.json')
  ];

  let seedJson = null;
  for (const p of seedPaths) {
    if (fs.existsSync(p)) {
      seedJson = JSON.parse(fs.readFileSync(p, 'utf8'));
      break;
    }
  }

  if (!seedJson || !seedJson.document) {
    throw new Error('Seed file not found or invalid format');
  }

  const doc = seedJson.document;
  const lines = [...(doc.sections || [])];
  const count = doc.generatedLineCount || 0;
  const width = doc.generatedLineNumberWidth || 4;
  const template = doc.generatedLineTemplate || 'Log line {n}';

  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(width, '0');
    lines.push(template.replace(/\{n\}/g, n));
  }

  if (doc.tailSections && Array.isArray(doc.tailSections)) {
    lines.push(...doc.tailSections);
  }

  const content = lines.join('\n');

  return {
    id: doc.id || 'incident-alpha',
    title: doc.title || 'Northwind API Incident Report',
    author: doc.author || 'Riley Stone',
    summary: doc.summary || 'Incident Report',
    content
  };
}

module.exports = {
  loadSeedData
};
