# Analytics Module Documentation

## Overview

The Analytics Module provides comprehensive data analysis capabilities for your order management system. It's designed to work with multiple data sources (currently Glide API, with future support for internal databases) and provides insights into item popularity, quantity trends, and statistical analysis.

## Architecture

### Modular Design
```
modules/analytics/
├── models/           # Data models
├── services/         # Business logic
├── processors/       # Data processing
├── adapters/         # Data source adapters
└── routes/          # API endpoints
```

### Data Source Abstraction
The module uses an adapter pattern to support multiple data sources:
- **GlideAdapter**: Fetches data from Glide API
- **InternalAdapter**: Future support for internal database
- **DataSourceFactory**: Manages and switches between adapters

## Features

### 1. Item Analytics
- **Min/Max Quantities**: Track minimum and maximum order quantities per item
- **Average Quantities**: Calculate average order quantities
- **Popularity Scoring**: Rank items by popularity based on order frequency and quantity
- **Statistical Analysis**: Variance, standard deviation, and trend analysis

### 2. Trend Analysis
- **Time-based Trends**: Analyze quantity changes over time
- **Category Analysis**: Identify popular categories
- **Anomaly Detection**: Find unusual ordering patterns

### 3. Caching System
- **In-Memory Cache**: Fast access to frequently requested data
- **Configurable TTL**: Set cache duration via environment variables
- **Cache Management**: Clear cache and view cache statistics

### 4. Batch Processing
- **Weekly Analysis**: Designed for weekly batch processing
- **Configurable Limits**: Set item and order limits for processing
- **Progress Tracking**: Monitor analysis progress and performance

## API Endpoints

### Analytics Data

#### GET `/api/analytics/popular-items`
Get the most popular items based on order frequency and quantity.

**Query Parameters:**
- `limit` (optional): Number of items to return (1-100, default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "item_id": "item123",
      "source": "glide",
      "analysis_type": "popularity",
      "metrics": {
        "min_quantity": 10,
        "max_quantity": 100,
        "avg_quantity": 45.5,
        "total_orders": 25,
        "total_quantity": 1137.5,
        "popularity_score": 85
      },
      "analysis_date": "2024-01-15T10:30:00Z"
    }
  ],
  "metadata": {
    "limit": 10,
    "count": 10,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### GET `/api/analytics/items/:itemId`
Get detailed analytics for a specific item.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "item_id": "item123",
    "metrics": {
      "min_quantity": 5,
      "max_quantity": 50,
      "avg_quantity": 22.5,
      "total_orders": 15,
      "popularity_score": 65
    },
    "metadata": {
      "item_name": "Tomatoes",
      "category": "Vegetables",
      "unit": "kg"
    }
  }
}
```

#### GET `/api/analytics/trends`
Get trend analysis for items over time.

**Query Parameters:**
- `days` (optional): Number of days to analyze (1-365, default: 30)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "item_id": "item123",
      "item_name": "Tomatoes",
      "trend": "increasing",
      "change_percentage": 15.5,
      "recent_avg": 25.5,
      "overall_avg": 22.1
    }
  ]
}
```

#### GET `/api/analytics/anomalies`
Find items with unusual ordering patterns.

**Query Parameters:**
- `threshold` (optional): Anomaly detection threshold (default: 2)

#### GET `/api/analytics/summary`
Get overall summary statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_items": 150,
    "total_orders": 1250,
    "avg_orders_per_item": 8.33,
    "most_popular_category": {
      "name": "Vegetables",
      "orders": 450
    },
    "quantity_range": {
      "min": 1,
      "max": 500
    }
  }
}
```

### Analytics Control

#### POST `/api/analytics/run`
Manually trigger analytics analysis.

**Request Body:**
```json
{
  "itemLimit": 1000,
  "orderLimit": 1000
}
```

#### GET `/api/analytics/cache/stats`
Get cache statistics.

#### DELETE `/api/analytics/cache`
Clear the analytics cache.

### Data Source Management

#### GET `/api/analytics/data-sources`
Get information about available data sources.

#### POST `/api/analytics/data-sources/switch`
Switch to a different data source.

**Request Body:**
```json
{
  "type": "glide"
}
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Data Source Configuration
CURRENT_DATA_SOURCE=glide

# Glide API Configuration
GLIDE_API_URL=https://your-app.glideapp.io/api
GLIDE_API_TOKEN=your_glide_api_token_here
GLIDE_APP_ID=your_glide_app_id_here
GLIDE_SYNC_INTERVAL=weekly
GLIDE_API_RATE_LIMIT=100
GLIDE_API_TIMEOUT=30000

# Analytics Configuration
ANALYTICS_CACHE_DURATION=1800000  # 30 minutes
ANALYTICS_BATCH_SIZE=1000
POPULAR_ITEMS_LIMIT=10
TREND_ANALYSIS_DAYS=30
ANALYTICS_BACKUP_INTERVAL=3600000  # 1 hour
```

## Usage Examples

### 1. Get Popular Items
```bash
curl "http://localhost:3000/api/analytics/popular-items?limit=5"
```

### 2. Run Manual Analysis
```bash
curl -X POST "http://localhost:3000/api/analytics/run" \
  -H "Content-Type: application/json" \
  -d '{"itemLimit": 500, "orderLimit": 500}'
```

### 3. Get Item-Specific Analytics
```bash
curl "http://localhost:3000/api/analytics/items/item123"
```

### 4. Check Cache Status
```bash
curl "http://localhost:3000/api/analytics/cache/stats"
```

## Testing

Run the analytics test suite:

```bash
node test-analytics.js
```

This will test:
- Data source factory functionality
- Analytics processing
- Popular items calculation
- Summary statistics
- Cache management

## Future Enhancements

### 1. Database Integration
- Add analytics tables to SQLite database
- Implement persistent storage for analytics results
- Add historical analytics tracking

### 2. Real-time Updates
- WebSocket support for real-time analytics updates
- Event-driven analytics processing
- Live dashboard integration

### 3. Advanced Analytics
- Machine learning for demand prediction
- Seasonal trend analysis
- Supplier performance analytics
- Cost optimization recommendations

### 4. UI Integration
- Analytics dashboard in admin interface
- Interactive charts and graphs
- Export functionality for reports
- Automated UI updates based on analytics

## Deployment on Render

### 1. Environment Setup
Set the following environment variables in your Render dashboard:
- `GLIDE_API_URL`
- `GLIDE_API_TOKEN`
- `GLIDE_APP_ID`
- `CURRENT_DATA_SOURCE=glide`

### 2. Database Considerations
For production deployment, consider:
- Using PostgreSQL instead of SQLite
- Setting up automated backups
- Implementing connection pooling

### 3. Performance Optimization
- Set appropriate cache durations
- Configure rate limits
- Monitor memory usage
- Set up logging and monitoring

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Verify Glide API credentials
   - Check network connectivity
   - Validate API endpoint URLs

2. **Cache Issues**
   - Clear cache: `DELETE /api/analytics/cache`
   - Check cache statistics: `GET /api/analytics/cache/stats`

3. **Performance Issues**
   - Reduce batch sizes
   - Increase cache duration
   - Check data source response times

### Logs
Check the application logs for detailed error information:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## Support

For issues or questions:
1. Check the logs for error details
2. Verify configuration settings
3. Test with the provided test script
4. Review API documentation 