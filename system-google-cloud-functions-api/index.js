const express = require('express');
const app = express();

// Health check endpoint
app.get('/', (req, res) => {
  res.send('OK');
});

// Import your core handler
const coreHandler = require('./core');

// Parse JSON body
app.use(express.json());

// Main POST endpoint
app.post('/', coreHandler);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

