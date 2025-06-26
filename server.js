import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import logger from './logger.js';
import { processStagedOrders } from './process-staged-orders.js';
import { metricsMiddleware, metrics } from './shared/monitoring/index.js';

// Import analytics routes
import analyticsRoutes from './modules/analytics/routes/analytics-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database before setting up routes
await db.initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(metricsMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  next();
});

// Monitoring endpoint (protected by basic auth)
app.get('/monitoring', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !process.env.MONITORING_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.MONITORING_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const monitoringData = {
    ...metrics.getMetrics(),
    processInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    }
  };

  res.json(monitoringData);
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    
    // Check system uptime
    const uptime = process.uptime();
    
    // Get active connections (if available)
    let activeConnections = 0;
    if (db.getActiveConnections) {
      activeConnections = await db.getActiveConnections();
    }

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
      },
      database: {
        connected: true,
        activeConnections: activeConnections
      },
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Simple health check for load balancers
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Analytics page
app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Glide Webhook Endpoint for Creating Orders
app.post('/webhook/create-order', async (req, res) => {
  try {
    const data = req.body.body || req.body;
    logger.info('Received webhook request', { data });

    // Store the raw webhook event in the staging table
    const eventId = await db.insertWebhookEvent(data);

    res.json({
      success: true,
      message: 'Order webhook event received and staged',
      event_id: eventId
    });

  } catch (error) {
    logger.error('Error processing Glide webhook', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

// Get Order Status Endpoint
app.get('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await db.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        order_id: orderId
      });
    }

    res.json({
      success: true,
      order_id: orderId,
      status: order.status,
      created_at: order.timestamp
    });

  } catch (error) {
    logger.error('Error getting order status', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to get order status',
      message: error.message
    });
  }
});

// Get Supplier Orders Endpoint
app.get('/supplier/:supplierId/orders', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const orders = await db.getSupplierOrders(supplierId);
    
    res.json({
      success: true,
      supplier_id: supplierId,
      orders: orders
    });

  } catch (error) {
    logger.error('Error getting supplier orders', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to get supplier orders',
      message: error.message
    });
  }
});

// Admin dashboard redirect
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

// Admin Orders Dashboard Endpoint
app.get('/admin/orders', async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    logger.error('Error getting admin orders', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to get admin orders',
      message: error.message
    });
  }
});

// API endpoint to get all locations (id and name)
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getAllLocations();
    res.json({ success: true, data: locations });
  } catch (error) {
    logger.error('Error getting locations', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get locations', message: error.message });
  }
});

// API endpoint to get all suppliers (id and name)
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await db.getAllSuppliers();
    res.json({ success: true, data: suppliers });
  } catch (error) {
    logger.error('Error getting suppliers', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get suppliers', message: error.message });
  }
});

// API endpoint to get all users (id and name)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Error getting users', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get users', message: error.message });
  }
});

// API endpoint to get all locations with brand name
app.get('/api/locations-with-brand', async (req, res) => {
  try {
    const locations = await db.getAllLocationsWithBrand();
    res.json({ success: true, data: locations });
  } catch (error) {
    logger.error('Error getting locations with brand', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get locations with brand', message: error.message });
  }
});

// API endpoint to get order lines for a given order
app.get('/api/orders/:orderId/lines', async (req, res) => {
  try {
    const { orderId } = req.params;
    const lines = await db.getOrderLinesByOrderId(orderId);
    res.json({ success: true, data: lines });
  } catch (error) {
    logger.error('Error getting order lines', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get order lines', message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Restaurant-Supplier API running on port ${PORT}`);
  console.log(`📊 Supplier portals available at: http://localhost:${PORT}/supplier/{supplier-id}/portal`);
  console.log(`📈 Analytics API available at: http://localhost:${PORT}/api/analytics`);
});