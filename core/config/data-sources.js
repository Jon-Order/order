// import 'dotenv/config'; // This is now handled by the application's entry point

// Data source configuration for different environments
export const DATA_SOURCES = {
  current: process.env.CURRENT_DATA_SOURCE || 'glide',
  glide: {
    apiUrl: process.env.GLIDE_API_URL || 'https://api.glideapp.io/api/function/queryTables',
    token: process.env.GLIDE_API_TOKEN,
    appId: process.env.GLIDE_APP_ID || '5gyrohBpLyf0trjfoHsp',
    orderLinesTableName: process.env.GLIDE_ORDER_LINES_TABLE_NAME || 'native-table-efbe8bf7-3e63-4734-9e3b-f8b56ae718f3',
    ordersTableName: process.env.GLIDE_ORDERS_TABLE_NAME || 'native-table-wjStO6oCHg10etiFtMLH',
    syncInterval: process.env.GLIDE_SYNC_INTERVAL || 'weekly',
    rateLimit: parseInt(process.env.GLIDE_API_RATE_LIMIT) || 100,
    timeout: parseInt(process.env.GLIDE_API_TIMEOUT) || 30000
  },
  internal: {
    databaseUrl: process.env.NODE_ENV === 'test' 
      ? process.env.DATABASE_URL  // Use PostgreSQL in test
      : process.env.INTERNAL_DB_URL, // Use SQLite in development
    syncInterval: process.env.INTERNAL_SYNC_INTERVAL || 'daily',
    connectionPool: parseInt(process.env.DB_CONNECTION_POOL) || 10
  }
};

// Analytics configuration
export const ANALYTICS_CONFIG = {
  cacheDuration: parseInt(process.env.ANALYTICS_CACHE_DURATION) || 1800000, // 30 minutes
  batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE) || 1000,
  popularItemsLimit: parseInt(process.env.POPULAR_ITEMS_LIMIT) || 10,
  trendAnalysisDays: parseInt(process.env.TREND_ANALYSIS_DAYS) || 30,
  backupInterval: parseInt(process.env.ANALYTICS_BACKUP_INTERVAL) || 3600000 // 1 hour
};

// Environment-specific settings
export const ENV_CONFIG = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
}; 