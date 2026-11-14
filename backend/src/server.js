import app from './app.js';
import { config } from './config/env.js';
import prisma from './config/db.js';

const PORT = config.port || 5000;
const cors = require("cors");

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://shiksha-track-major-project.vercel.app"
  ],
  credentials: true
}));

async function startServer() {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database successfully.');

    app.listen(PORT, () => {
      console.log(`🚀 ShikshaTrack Backend running on http://localhost:${PORT}`);
      console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

