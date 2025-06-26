import { ItemAnalytics } from '../models/ItemAnalytics.js';

export class QuantityAnalyzer {
  constructor() {
    this.analysisCache = new Map();
    this.dayMapping = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  }

  // Analyze quantities for a collection of items
  async analyzeItemQuantities(items, orders) {
    const analysis = [];
    const itemQuantities = this.groupItemQuantities(items, orders);

    for (const [itemId, quantities] of itemQuantities) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;

      const analytics = this.calculateItemAnalytics(itemId, quantities, item);
      analysis.push(analytics);
    }

    return analysis;
  }

  // Group quantities by item ID from orders
  groupItemQuantities(items, orders) {
    const itemQuantities = new Map();

    items.forEach(item => {
      itemQuantities.set(item.id, []);
    });

    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(orderItem => {
          // Only include order lines with quantity >= 1
          const qty = parseFloat(orderItem.quantity) || 0;
          if (qty >= 1) {
            const quantities = itemQuantities.get(orderItem.item_id);
            if (quantities) {
              quantities.push({
                quantity: qty,
                order_id: order.id,
                order_date: orderItem.order_date, // Use date from the item
                location_id: orderItem.location_id, // Pass location
                unit: orderItem.unit
              });
            }
          }
        });
      }
    });

    return itemQuantities;
  }

  // Calculate analytics for a specific item, including breakdowns
  calculateItemAnalytics(itemId, quantities, item) {
    const metrics = {
      min_quantity: 0,
      max_quantity: 0,
      avg_quantity: 0,
      total_orders: 0,
      total_quantity: 0,
      popularity_score: 0,
    };

    const breakdowns = {
      by_location: {},
      by_day_of_week: {},
      by_location_period: {}
    };

    if (quantities.length > 0) {
      const quantityValues = quantities.map(q => q.quantity);
      metrics.min_quantity = Math.min(...quantityValues);
      metrics.max_quantity = Math.max(...quantityValues);
      metrics.total_quantity = quantityValues.reduce((sum, q) => sum + q, 0);
      metrics.total_orders = quantities.length;
      metrics.avg_quantity = metrics.total_quantity / metrics.total_orders;
      
      const orderScore = Math.min(metrics.total_orders / 10, 50);
      const quantityScore = Math.min(metrics.avg_quantity / 100, 50);
      metrics.popularity_score = Math.round(orderScore + quantityScore);

      // --- NEW: Calculate Breakdowns ---
      const locationGroups = {};
      const dayOfWeekGroups = {};
      const locationPeriodGroups = {};

      quantities.forEach(q => {
        // Group by Location
        const locId = q.location_id || 'unknown';
        if (!locationGroups[locId]) locationGroups[locId] = [];
        locationGroups[locId].push(q.quantity);

        // Group by Day of Week
        let dayName = 'Unknown';
        let dayIndex = null;
        try {
          const date = new Date(q.order_date);
          dayIndex = date.getUTCDay();
          dayName = this.dayMapping[dayIndex];
          if (!dayOfWeekGroups[dayName]) dayOfWeekGroups[dayName] = [];
          dayOfWeekGroups[dayName].push(q.quantity);
        } catch(e) {
          // Ignore if date is invalid
        }

        // Group by Location + Period (Weekday/Weekend)
        let period = 'Unknown';
        if (dayIndex !== null) {
          // Weekday: Sunday (0) - Wednesday (3), Weekend: Thursday (4) - Saturday (6)
          period = (dayIndex >= 0 && dayIndex <= 3) ? 'Weekday' : 'Weekend';
        }
        if (!locationPeriodGroups[locId]) locationPeriodGroups[locId] = { Weekday: [], Weekend: [] };
        if (period === 'Weekday' || period === 'Weekend') {
          locationPeriodGroups[locId][period].push(q.quantity);
        }
      });

      // Calculate stats for location groups
      for (const locId in locationGroups) {
        const groupQuantities = locationGroups[locId];
        breakdowns.by_location[locId] = {
          min: Math.min(...groupQuantities),
          max: Math.max(...groupQuantities),
          avg: groupQuantities.reduce((a, b) => a + b, 0) / groupQuantities.length,
          total_orders: groupQuantities.length
        };
      }

      // Calculate stats for day of week groups
      for (const dayName in dayOfWeekGroups) {
        const groupQuantities = dayOfWeekGroups[dayName];
        breakdowns.by_day_of_week[dayName] = {
          min: Math.min(...groupQuantities),
          max: Math.max(...groupQuantities),
          avg: groupQuantities.reduce((a, b) => a + b, 0) / groupQuantities.length,
          total_orders: groupQuantities.length
        };
      }

      // Calculate stats for location + period (Weekday/Weekend)
      for (const locId in locationPeriodGroups) {
        breakdowns.by_location_period[locId] = {};
        for (const period of ['Weekday', 'Weekend']) {
          const groupQuantities = locationPeriodGroups[locId][period];
          if (groupQuantities.length > 0) {
            breakdowns.by_location_period[locId][period] = {
              min: Math.min(...groupQuantities),
              max: Math.max(...groupQuantities),
              total_orders: groupQuantities.length
            };
          }
        }
      }
    }

    return new ItemAnalytics({
      item_id: itemId,
      source: item.source || 'glide',
      analysis_type: 'breakdown_analysis',
      metrics,
      breakdowns,
      metadata: {
        item_name: item.name,
        supplier_id: item.supplier_id,
        category: item.category,
        unit: item.unit,
      }
    });
  }

  // Find popular items based on order frequency and quantity
  findPopularItems(analytics, limit = 10) {
    return analytics
      .filter(a => a.metrics.total_orders > 0)
      .sort((a, b) => {
        // Sort by popularity score first, then by total orders
        if (a.metrics.popularity_score !== b.metrics.popularity_score) {
          return b.metrics.popularity_score - a.metrics.popularity_score;
        }
        return b.metrics.total_orders - a.metrics.total_orders;
      })
      .slice(0, limit);
  }

  // Analyze trends over time
  analyzeTrends(analytics, days = 30) {
    const trends = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    analytics.forEach(analysis => {
      const recentQuantities = analysis.metadata.quantity_history?.filter(q => 
        new Date(q.order_date) >= cutoffDate
      ) || [];

      if (recentQuantities.length > 0) {
        const recentAvg = recentQuantities.reduce((sum, q) => sum + q.quantity, 0) / recentQuantities.length;
        const trend = {
          item_id: analysis.item_id,
          item_name: analysis.metadata.item_name,
          trend: recentAvg > analysis.metrics.avg_quantity ? 'increasing' : 'decreasing',
          change_percentage: ((recentAvg - analysis.metrics.avg_quantity) / analysis.metrics.avg_quantity) * 100,
          recent_avg: recentAvg,
          overall_avg: analysis.metrics.avg_quantity
        };
        trends.push(trend);
      }
    });

    return trends.sort((a, b) => Math.abs(b.change_percentage) - Math.abs(a.change_percentage));
  }

  // Get items with unusual quantity patterns
  findAnomalies(analytics, threshold = 2) {
    return analytics.filter(analysis => {
      if (analysis.metrics.total_orders < 3) return false; // Need enough data
      
      const stdDev = analysis.metrics.quantity_std_dev;
      const mean = analysis.metrics.avg_quantity;
      
      // Check if max quantity is significantly higher than mean
      const maxZScore = (analysis.metrics.max_quantity - mean) / stdDev;
      return maxZScore > threshold;
    });
  }

  // Generate summary statistics
  generateSummary(analytics) {
    if (!analytics || analytics.length === 0) {
      return {
        total_items: 0,
        total_order_lines: 0, // Changed from total_orders
        avg_orders_per_item: 0,
        most_popular_item: null,
      };
    }

    const totalOrderLines = analytics.reduce((sum, a) => sum + (a.metrics.total_orders || 0), 0);
    
    const mostPopular = analytics.sort((a,b) => (b.metrics.popularity_score || 0) - (a.metrics.popularity_score || 0))[0];

    return {
      total_items: analytics.length,
      total_order_lines: totalOrderLines,
      avg_orders_per_item: totalOrderLines / analytics.length,
      most_popular_item: mostPopular ? {
        name: mostPopular.metadata.item_name,
        orders: mostPopular.metrics.total_orders
      } : null,
    };
  }
} 