// Data model for item analytics
export class ItemAnalytics {
  constructor(data = {}) {
    this.id = data.id || null;
    this.item_id = data.item_id;
    this.source = data.source || 'glide';
    this.analysis_type = data.analysis_type || 'breakdown_analysis';
    this.analysis_date = data.analysis_date || new Date().toISOString();
    
    // Consolidate metrics and breakdowns into single objects
    this.metrics = data.metrics || {};
    this.breakdowns = data.breakdowns || { by_location: {}, by_day_of_week: {} };
    this.metadata = data.metadata || {};
  }

  // Calculate additional metrics
  calculateMetrics() {
    this.quantity_variance = this.calculateVariance();
    this.quantity_std_dev = Math.sqrt(this.quantity_variance);
    this.popularity_score = this.calculatePopularityScore();
  }

  // Calculate variance of quantities
  calculateVariance() {
    if (this.total_orders <= 1) return 0;
    
    // This would need actual quantity data to calculate properly
    // For now, we'll use a simplified calculation
    const mean = this.avg_quantity;
    const range = this.max_quantity - this.min_quantity;
    return Math.pow(range / 2, 2);
  }

  // Calculate popularity score (0-100)
  calculatePopularityScore() {
    // Simple popularity score based on total orders and average quantity
    const orderScore = Math.min(this.total_orders / 10, 50); // Max 50 points for orders
    const quantityScore = Math.min(this.avg_quantity / 100, 50); // Max 50 points for quantity
    return Math.round(orderScore + quantityScore);
  }

  // Convert to database format
  toDatabaseFormat() {
    return {
      id: this.id,
      item_id: this.item_id,
      source: this.source,
      analysis_type: this.analysis_type,
      // Serialize metrics, breakdowns, and metadata for storage
      metrics: JSON.stringify(this.metrics),
      breakdowns: JSON.stringify(this.breakdowns),
      metadata: JSON.stringify(this.metadata),
      analysis_date: this.analysis_date,
    };
  }

  // Convert to API format
  toApiFormat() {
    return {
      id: this.id,
      item_id: this.item_id,
      source: this.source,
      analysis_type: this.analysis_type,
      metrics: this.metrics,
      breakdowns: this.breakdowns,
      metadata: this.metadata,
      analysis_date: this.analysis_date,
    };
  }

  // Create from database format
  static fromDatabaseFormat(dbRow) {
    const data = {
      id: dbRow.id,
      item_id: dbRow.item_id,
      source: dbRow.source,
      analysis_type: dbRow.analysis_type,
      analysis_date: dbRow.analysis_date,
    };

    try {
      // Safely parse JSON fields
      data.metrics = dbRow.metrics ? JSON.parse(dbRow.metrics) : {};
      data.breakdowns = dbRow.breakdowns ? JSON.parse(dbRow.breakdowns) : {};
      data.metadata = dbRow.metadata ? JSON.parse(dbRow.metadata) : {};
    } catch (error) {
      console.error('Failed to parse JSON from database for item:', dbRow.item_id, error);
      // Initialize with empty objects on failure
      data.metrics = {};
      data.breakdowns = {};
      data.metadata = {};
    }
    
    return new ItemAnalytics(data);
  }
} 