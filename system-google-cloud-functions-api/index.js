const express = require('express');
const app = express();

// Import your existing core handler
const coreHandler = require('./core');

// Make sure JSON body parsing is enabled
app.use(express.json());

// Mount your handler (assuming it's a function handling POST requests)
app.post('/', coreHandler);

// Determine port: use Cloud Run-provided PORT or default locally
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

