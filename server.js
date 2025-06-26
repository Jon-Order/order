import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import logger from './logger.js';
import { processStagedOrders } from './process-staged-orders.js';

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

// Health check
app.get('/health', (req, res) => {
  const metrics = db.monitoring.getHealthMetrics();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    metrics
  });
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

    // Automatically process staged orders after receiving webhook
    await processStagedOrders();

    res.json({
      success: true,
      message: 'Order webhook event received, staged, and processed',
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