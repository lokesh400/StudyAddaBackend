require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Simple status route for health checks
app.get('/status', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    const server = app.listen(PORT, () => {
      console.log(`StudyAdda running on http://localhost:${PORT}`);

      // Start periodic self-checks after server is listening
      const checkUrl = `http://studyadda.tech/status`;
      const checkStatus = () => {
        http.get(checkUrl, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            console.log('Status check:', res.statusCode, body);
          });
        }).on('error', (err) => {
          console.error('Status check error:', err.message);
        });
      };

      // Run immediately, then every 10 seconds
      checkStatus();
      setInterval(checkStatus, 10 * 1000);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();
