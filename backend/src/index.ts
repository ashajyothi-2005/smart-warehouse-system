import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import warehouseRoutes from './routes/warehouseRoutes';
import { initSocketServer } from './websocket/socketServer';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Root health & status endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'online',
    engine: 'Smart Warehouse Decision Engine API',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Attach REST routes
app.use('/api', warehouseRoutes);

// Initialize WebSocket
initSocketServer(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Smart Warehouse Backend] Running on http://localhost:${PORT}`);
});