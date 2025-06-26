// Abstract base class for data source adapters
export class DataSourceAdapter {
  constructor(config) {
    this.config = config;
    this.name = this.constructor.name;
  }

  // Abstract methods that must be implemented by subclasses
  async fetchItems(options = {}) {
    throw new Error(`${this.name}: fetchItems() not implemented`);
  }

  async fetchItemById(id) {
    throw new Error(`${this.name}: fetchItemById() not implemented`);
  }

  async fetchOrders(options = {}) {
    throw new Error(`${this.name}: fetchOrders() not implemented`);
  }

  async fetchOrderById(id) {
    throw new Error(`${this.name}: fetchOrderById() not implemented`);
  }

  async fetchAnalytics(options = {}) {
    throw new Error(`${this.name}: fetchAnalytics() not implemented`);
  }

  // Common utility methods
  async validateConnection() {
    throw new Error(`${this.name}: validateConnection() not implemented`);
  }

  async getMetadata() {
    return {
      source: this.name,
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }

  // Error handling wrapper
  async executeWithRetry(operation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`${this.name}: Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`${this.name}: Operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }
} 