import logger from '../../logger.js';

class Metrics {
  constructor() {
    this.requestCounts = {
      total: 0,
      success: 0,
      error: 0
    };
    this.responseTimes = [];
    this.lastErrors = [];
    this.startTime = Date.now();
  }

  trackRequest(duration, status) {
    this.requestCounts.total++;
    if (status >= 200 && status < 400) {
      this.requestCounts.success++;
    } else {
      this.requestCounts.error++;
    }
    this.responseTimes.push(duration);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  trackError(error, context = {}) {
    this.lastErrors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      context
    });

    // Keep only last 50 errors
    if (this.lastErrors.length > 50) {
      this.lastErrors.shift();
    }

    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  getMetrics() {
    const uptime = (Date.now() - this.startTime) / 1000; // in seconds
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return {
      uptime,
      requests: {
        ...this.requestCounts,
        successRate: this.requestCounts.total > 0
          ? (this.requestCounts.success / this.requestCounts.total * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime) + 'ms',
        recentResponseTimes: this.responseTimes.slice(-10)
      },
      errors: {
        count: this.lastErrors.length,
        recent: this.lastErrors.slice(-5)
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
      }
    };
  }

  reset() {
    this.requestCounts = {
      total: 0,
      success: 0,
      error: 0
    };
    this.responseTimes = [];
    this.lastErrors = [];
    this.startTime = Date.now();
  }
}

export const metrics = new Metrics();

// Middleware to track request metrics
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Add response listener
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.trackRequest(duration, res.statusCode);
  });
  
  next();
};

// Error tracking function
export const trackError = (error, context = {}) => {
  metrics.trackError(error, context);
};

export default {
  metrics,
  metricsMiddleware,
  trackError
}; 