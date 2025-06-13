import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// Glide Webhook Endpoint for Creating Orders
app.post('/webhook/create-order', async (req, res) => {
  try {
    const {
      order_id,
      supplier_id,
      supplier_mask,
      location_mask,
      user_id,
      supplier_name,
      location_name
    } = req.body;

    logger.info('Received webhook request', { data: req.body });

    // Validate required fields
    if (!order_id || !supplier_id) {
      logger.error('Missing required fields in webhook payload', { received: req.body });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['order_id', 'supplier_id'],
        received: req.body
      });
    }

    // Create order object with Glide data
    const order = {
      id: order_id,
      supplier_id: supplier_id,
      supplier_name: supplier_name,
      location_name: location_name,
      status: 'pending',
      created_by: user_id,
      timestamp: new Date().toISOString(),
      metadata: {
        supplier_mask,
        location_mask,
        user_id
      }
    };

    // Store the order in database
    const savedOrder = await db.createOrder(order);
    logger.info('Order created from Glide webhook', { 
      order_id: savedOrder.id, 
      supplier_id,
      supplier_name 
    });

    // Return success response
    res.json({
      success: true,
      message: 'Order created successfully via Glide webhook',
      order_id: savedOrder.id,
      data: savedOrder
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
      supplier_name: order.supplier_name,
      location_name: order.location_name,
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Restaurant-Supplier API running on port ${PORT}`);
  console.log(`📊 Supplier portals available at: http://localhost:${PORT}/supplier/{supplier-id}/portal`);
});