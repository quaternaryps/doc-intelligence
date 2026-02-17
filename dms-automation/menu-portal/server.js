const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const PORT = process.env.PORT || 5000;
const AUTOPROCESSOR_URL = process.env.AUTOPROCESSOR_URL || 'http://dms-autoprocessor-api:8000';

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Proxy API calls to autoprocessor
app.get('/api/folders', async (req, res) => {
  const year = req.query.year || '2026';
  try {
    const response = await fetch(`${AUTOPROCESSOR_URL}/folders/company-daily?year=${year}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders: ' + error.message });
  }
});

app.post('/api/process-folder', async (req, res) => {
  const { folderPath } = req.body;
  try {
    const response = await fetch(`${AUTOPROCESSOR_URL}/process/company-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process folder: ' + error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DMS Menu Portal running on port ${PORT}`);
});
