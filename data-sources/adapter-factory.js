import { GlideAdapter } from './glide-adapter.js';
import { DATA_SOURCES } from '../core/config/data-sources.js';

export class DataSourceFactory {
  constructor() {
    this.adapters = new Map();
    this.currentAdapter = null;
  }

  // Get or create an adapter for the specified type
  async getAdapter(type = null) {
    const adapterType = type || DATA_SOURCES.current;
    
    if (this.adapters.has(adapterType)) {
      return this.adapters.get(adapterType);
    }

    const adapter = await this.createAdapter(adapterType);
    this.adapters.set(adapterType, adapter);
    
    if (!this.currentAdapter) {
      this.currentAdapter = adapter;
    }
    
    return adapter;
  }

  // Create a new adapter instance
  async createAdapter(type) {
    const config = DATA_SOURCES[type];
    
    if (!config) {
      throw new Error(`Unknown data source type: ${type}`);
    }

    switch (type) {
      case 'glide':
        return new GlideAdapter(config);
      
      case 'internal':
        // TODO: Implement when you have your own database
        throw new Error('Internal adapter not yet implemented');
      
      default:
        throw new Error(`Unsupported data source type: ${type}`);
    }
  }

  // Switch the current data source
  async switchDataSource(type) {
    const adapter = await this.getAdapter(type);
    this.currentAdapter = adapter;
    
    // Validate the new connection
    const isValid = await adapter.validateConnection();
    if (!isValid) {
      throw new Error(`Failed to validate connection for data source: ${type}`);
    }
    
    console.log(`Switched to data source: ${type}`);
    return adapter;
  }

  // Get the current adapter
  getCurrentAdapter() {
    if (!this.currentAdapter) {
      throw new Error('No current adapter set. Call getAdapter() first.');
    }
    return this.currentAdapter;
  }

  // Get metadata for all available adapters
  async getAllAdapterMetadata() {
    const metadata = {};
    
    for (const [type, adapter] of this.adapters) {
      metadata[type] = await adapter.getMetadata();
    }
    
    return metadata;
  }

  // Test connection for a specific adapter type
  async testConnection(type) {
    try {
      const adapter = await this.createAdapter(type);
      const isValid = await adapter.validateConnection();
      return {
        type,
        valid: isValid,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type,
        valid: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get available data source types
  getAvailableTypes() {
    return Object.keys(DATA_SOURCES).filter(key => key !== 'current');
  }
}

// Export singleton instance
export const dataSourceFactory = new DataSourceFactory(); 