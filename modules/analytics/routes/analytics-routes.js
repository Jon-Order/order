import express from 'express';
import { analyticsService } from '../services/AnalyticsService.js';
import { dataSourceFactory } from '../../../data-sources/adapter-factory.js';
import logger from '../../../logger.js';

const router = express.Router();

// Middleware to validate analytics requests
const validateAnalyticsRequest = (req, res, next) => {
  const { limit, days, threshold } = req.query;
  
  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({
      error: 'Invalid limit parameter. Must be between 1 and 100.'
    });
  }
  
  if (days && (isNaN(days) || days < 1 || days > 365)) {
    return res.status(400).json({
      error: 'Invalid days parameter. Must be between 1 and 365.'
    });
  }
  
  if (threshold && (isNaN(threshold) || threshold < 0)) {
    return res.status(400).json({
      error: 'Invalid threshold parameter. Must be a positive number.'
    });
  }
  
  next();
};

// GET /api/analytics - Redirect to the dashboard
router.get('/', (req, res) => {
  res.redirect('/analytics');
});

// GET /api/analytics/all - Get all latest analytics
router.get('/all', async (req, res) => {
  try {
    const analytics = await analyticsService.getAllAnalytics();
    const summary = analytics.length > 0 ? analyticsService.analyzer.generateSummary(analytics) : {};
    
    res.json({
      success: true,
      data: {
        analytics,
        summary
      },
      metadata: {
        count: analytics.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching all analytics', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch all analytics',
      message: error.message
    });
  }
});

// GET /api/analytics/popular-items - Get popular items
router.get('/popular-items', validateAnalyticsRequest, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const popularItems = await analyticsService.getPopularItems(limit);
    
    res.json({
      success: true,
      data: popularItems,
      metadata: {
        limit,
        count: popularItems.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching popular items', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch popular items',
      message: error.message
    });
  }
});

// GET /api/analytics/items/:itemId - Get analytics for specific item
router.get('/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const analytics = await analyticsService.getItemAnalytics(itemId);
    
    if (!analytics) {
      return res.status(404).json({
        error: 'Item analytics not found',
        item_id: itemId
      });
    }
    
    res.json({
      success: true,
      data: analytics,
      metadata: {
        item_id: itemId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching item analytics', {
      itemId: req.params.itemId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch item analytics',
      message: error.message
    });
  }
});

// GET /api/analytics/trends - Get trend analysis
router.get('/trends', validateAnalyticsRequest, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const trends = await analyticsService.getTrends(days);
    
    res.json({
      success: true,
      data: trends,
      metadata: {
        days,
        count: trends.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching trends', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch trends',
      message: error.message
    });
  }
});

// GET /api/analytics/anomalies - Get anomalies
router.get('/anomalies', validateAnalyticsRequest, async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 2;
    const anomalies = await analyticsService.getAnomalies(threshold);
    
    res.json({
      success: true,
      data: anomalies,
      metadata: {
        threshold,
        count: anomalies.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching anomalies', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch anomalies',
      message: error.message
    });
  }
});

// GET /api/analytics/summary - Get summary statistics
router.get('/summary', async (req, res) => {
  try {
    const summary = await analyticsService.getSummary();
    
    res.json({
      success: true,
      data: summary,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching summary', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch summary',
      message: error.message
    });
  }
});

// POST /api/analytics/run - Manually trigger analytics analysis
router.post('/run', async (req, res) => {
  try {
    const options = {
      itemLimit: parseInt(req.body.itemLimit) || 1000,
      orderLimit: parseInt(req.body.orderLimit) || 1000
    };
    
    const result = await analyticsService.runAnalytics(options);
    
    res.json({
      success: true,
      message: 'Analytics analysis completed successfully',
      data: result,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error running analytics', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to run analytics',
      message: error.message
    });
  }
});

// GET /api/analytics/cache/stats - Get cache statistics
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = analyticsService.getCacheStats();
    
    res.json({
      success: true,
      data: stats,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching cache stats', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch cache stats',
      message: error.message
    });
  }
});

// DELETE /api/analytics/cache - Clear analytics cache
router.delete('/cache', async (req, res) => {
  try {
    analyticsService.clearCache();
    
    res.json({
      success: true,
      message: 'Analytics cache cleared successfully',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error clearing cache', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// GET /api/analytics/data-sources - Get data source information
router.get('/data-sources', async (req, res) => {
  try {
    const adapter = await dataSourceFactory.getCurrentAdapter();
    const metadata = await adapter.getMetadata();
    const availableTypes = dataSourceFactory.getAvailableTypes();
    
    res.json({
      success: true,
      data: {
        current: adapter.name,
        available: availableTypes,
        metadata
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching data source info', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch data source info',
      message: error.message
    });
  }
});

// POST /api/analytics/data-sources/switch - Switch data source
router.post('/data-sources/switch', async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!type) {
      return res.status(400).json({
        error: 'Data source type is required'
      });
    }
    
    const adapter = await dataSourceFactory.switchDataSource(type);
    const metadata = await adapter.getMetadata();
    
    res.json({
      success: true,
      message: `Switched to data source: ${type}`,
      data: {
        type,
        metadata
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error switching data source', {
      type: req.body.type,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to switch data source',
      message: error.message
    });
  }
});

export default router; 