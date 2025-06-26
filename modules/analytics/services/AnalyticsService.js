import { dataSourceFactory } from '../../../data-sources/adapter-factory.js';
import { QuantityAnalyzer } from '../processors/QuantityAnalyzer.js';
import { ItemAnalytics } from '../models/ItemAnalytics.js';
import { ANALYTICS_CONFIG } from '../../../core/config/data-sources.js';
import logger from '../../../logger.js';
import db from '../../../db.js';

export class AnalyticsService {
  constructor() {
    this.analyzer = new QuantityAnalyzer();
    this.cache = new Map();
    this.lastAnalysis = null;
  }

  // Main method to run analytics analysis
  async runAnalytics(options = {}) {
    const startTime = Date.now();
    logger.info('Starting analytics analysis', { options });

    try {
      // Get data source adapter
      const adapter = await dataSourceFactory.getAdapter();
      
      // Fetch data from source - call sequentially to avoid conflicts
      logger.info('Fetching items from data source...');
      const items = await adapter.fetchItems({ limit: options.itemLimit || 1000 });
      
      logger.info('Fetching orders from data source...');
      const orders = await adapter.fetchOrders({ limit: options.orderLimit || 1000 });

      logger.info('Data fetched successfully', { 
        itemsCount: items.length, 
        ordersCount: orders.length 
      });

      // Analyze quantities
      const analytics = await this.analyzer.analyzeItemQuantities(items, orders);
      
      // Store results
      await this.storeAnalytics(analytics);

      // Update cache
      this.updateCache(analytics);

      const duration = Date.now() - startTime;
      this.lastAnalysis = {
        timestamp: new Date().toISOString(),
        duration,
        itemsAnalyzed: analytics.length,
        dataSource: adapter.name
      };

      logger.info('Analytics analysis completed', {
        duration: `${duration}ms`,
        itemsAnalyzed: analytics.length
      });

      return {
        success: true,
        analytics: analytics.map(a => a.toApiFormat()),
        summary: this.analyzer.generateSummary(analytics),
        metadata: this.lastAnalysis
      };

    } catch (error) {
      logger.error('Analytics analysis failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Get all latest analytics
  async getAllAnalytics() {
    const cacheKey = `all_analytics`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ANALYTICS_CONFIG.cacheDuration) {
        return cached.data;
      }
    }

    // Try fetching from the database
    const dbAnalytics = await this.getAnalyticsFromDatabase();
    if (dbAnalytics && dbAnalytics.length > 0) {
      logger.info(`Fetched ${dbAnalytics.length} analytics records from the database`);
      const formattedAnalytics = dbAnalytics.map(a => a.toApiFormat());
      this.updateCache(formattedAnalytics);
      return formattedAnalytics;
    }

    // If DB is empty, run a fresh analysis
    logger.info('No analytics in database, running fresh analysis...');
    const result = await this.runAnalytics();
    return result.analytics;
  }

  // Get popular items
  async getPopularItems(limit = ANALYTICS_CONFIG.popularItemsLimit) {
    const cacheKey = `popular_items_${limit}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ANALYTICS_CONFIG.cacheDuration) {
        return cached.data;
      }
    }

    // Run analysis if needed
    const allAnalytics = await this.getAllAnalytics();
    const popularItems = this.analyzer.findPopularItems(allAnalytics, limit);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: popularItems.map(item => item.toApiFormat()),
      timestamp: Date.now()
    });

    return popularItems.map(item => item.toApiFormat());
  }

  // Get analytics for specific item
  async getItemAnalytics(itemId) {
    // Check cache first
    const cacheKey = `item_analytics_${itemId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ANALYTICS_CONFIG.cacheDuration) {
        return cached.data;
      }
    }

    // Get from database or run analysis
    const allAnalytics = await this.getAllAnalytics();
    const itemAnalytics = allAnalytics.find(a => a.item_id === itemId);

    if (itemAnalytics) {
      // Cache the result
      this.cache.set(cacheKey, {
        data: itemAnalytics,
        timestamp: Date.now()
      });

      return itemAnalytics;
    }

    return null;
  }

  // Get trend analysis
  async getTrends(days = ANALYTICS_CONFIG.trendAnalysisDays) {
    const cacheKey = `trends_${days}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ANALYTICS_CONFIG.cacheDuration) {
        return cached.data;
      }
    }

    const allAnalytics = await this.getAllAnalytics();
    const trends = this.analyzer.analyzeTrends(allAnalytics, days);
    
    this.cache.set(cacheKey, {
      data: trends,
      timestamp: Date.now()
    });

    return trends;
  }

  // Get anomalies
  async getAnomalies(threshold = 2) {
    const cacheKey = `anomalies_${threshold}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ANALYTICS_CONFIG.cacheDuration) {
        return cached.data;
      }
    }

    const allAnalytics = await this.getAllAnalytics();
    const anomalies = this.analyzer.findAnomalies(allAnalytics, threshold);
    
    this.cache.set(cacheKey, {
      data: anomalies.map(item => item.toApiFormat()),
      timestamp: Date.now()
    });

    return anomalies.map(item => item.toApiFormat());
  }

  // Get summary statistics
  async getSummary() {
    const cacheKey = 'summary';
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ANALYTICS_CONFIG.cacheDuration) {
        return cached.data;
      }
    }

    const allAnalytics = await this.getAllAnalytics();
    const summary = this.analyzer.generateSummary(allAnalytics);
    
    this.cache.set(cacheKey, {
      data: summary,
      timestamp: Date.now()
    });

    return summary;
  }

  // Store analytics in database
  async storeAnalytics(analytics) {
    if (!analytics || analytics.length === 0) return;
    try {
      await db.storeAnalyticsResults(analytics);
    } catch (error) {
      logger.error('Failed to store analytics results in database', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Get analytics from database
  async getAnalyticsFromDatabase() {
    try {
      const results = await db.getLatestAnalytics();
      return results.map(row => ItemAnalytics.fromDatabaseFormat(row));
    } catch (error) {
      logger.error('Failed to get analytics from database', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  // Update cache with new analytics
  updateCache(analytics) {
    const now = Date.now();

    // Cache the full results
    this.cache.set('all_analytics', {
      data: analytics,
      timestamp: now
    });

    // Clear old individual item cache entries
    for (const [key, value] of this.cache.entries()) {
      if (key !== 'all_analytics' && now - value.timestamp > ANALYTICS_CONFIG.cacheDuration) {
        this.cache.delete(key);
      }
    }

    // Update individual item caches
    analytics.forEach(item => {
      const cacheKey = `item_analytics_${item.item_id}`;
      this.cache.set(cacheKey, {
        data: item,
        timestamp: now
      });
    });
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    logger.info('Analytics cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      lastAnalysis: this.lastAnalysis
    };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService(); 