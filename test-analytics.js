import { analyticsService } from './modules/analytics/services/AnalyticsService.js';
import { dataSourceFactory } from './data-sources/adapter-factory.js';
import { GlideAdapter } from './data-sources/glide-adapter.js';

// Mock data for testing
const mockItems = [
  {
    id: 'item1',
    name: 'Tomatoes',
    supplier_id: 'supplier1',
    category: 'Vegetables',
    unit: 'kg',
    source: 'glide'
  },
  {
    id: 'item2',
    name: 'Chicken Breast',
    supplier_id: 'supplier1',
    category: 'Meat',
    unit: 'kg',
    source: 'glide'
  },
  {
    id: 'item3',
    name: 'Rice',
    supplier_id: 'supplier2',
    category: 'Grains',
    unit: 'kg',
    source: 'glide'
  }
];

const mockOrders = [
  {
    id: 'order1',
    supplier_id: 'supplier1',
    timestamp: '2024-01-01T10:00:00Z',
    items: [
      { item_id: 'item1', quantity: 50, unit: 'kg' },
      { item_id: 'item2', quantity: 25, unit: 'kg' }
    ]
  },
  {
    id: 'order2',
    supplier_id: 'supplier1',
    timestamp: '2024-01-02T10:00:00Z',
    items: [
      { item_id: 'item1', quantity: 30, unit: 'kg' },
      { item_id: 'item2', quantity: 40, unit: 'kg' }
    ]
  },
  {
    id: 'order3',
    supplier_id: 'supplier2',
    timestamp: '2024-01-03T10:00:00Z',
    items: [
      { item_id: 'item3', quantity: 100, unit: 'kg' }
    ]
  }
];

// Mock Glide adapter for testing
class MockGlideAdapter extends GlideAdapter {
  constructor() {
    super({
      apiUrl: 'https://mock.glideapp.io/api',
      token: 'mock-token',
      appId: 'mock-app'
    });
  }

  async fetchItems() {
    return mockItems;
  }

  async fetchOrders() {
    return mockOrders;
  }

  async validateConnection() {
    return true;
  }
}

// Override the createAdapter method in dataSourceFactory
const originalCreateAdapter = dataSourceFactory.createAdapter;
dataSourceFactory.createAdapter = async function(type) {
  if (type === 'glide') {
    return new MockGlideAdapter();
  }
  return originalCreateAdapter.call(this, type);
};

async function testAnalytics() {
  console.log('🧪 Testing Analytics Module...\n');

  try {
    // Test 1: Data Source Factory
    console.log('1. Testing Data Source Factory...');
    const factory = dataSourceFactory;
    const adapter = await factory.getAdapter('glide');
    console.log('✅ Data source factory working\n');

    // Test 2: Analytics Service
    console.log('2. Testing Analytics Service...');
    const result = await analyticsService.runAnalytics({
      itemLimit: 10,
      orderLimit: 10
    });
    
    console.log('✅ Analytics analysis completed');
    console.log(`   Items analyzed: ${result.analytics.length}`);
    console.log(`   Duration: ${result.metadata.duration}ms\n`);

    // Test 3: Popular Items
    console.log('3. Testing Popular Items...');
    const popularItems = await analyticsService.getPopularItems(5);
    console.log('✅ Popular items retrieved');
    console.log(`   Found ${popularItems.length} popular items\n`);

    // Test 4: Summary Statistics
    console.log('4. Testing Summary Statistics...');
    const summary = await analyticsService.getSummary();
    console.log('✅ Summary statistics generated');
    console.log(`   Total items: ${summary.total_items}`);
    console.log(`   Total orders: ${summary.total_orders}\n`);

    // Test 5: Cache Statistics
    console.log('5. Testing Cache...');
    const cacheStats = analyticsService.getCacheStats();
    console.log('✅ Cache statistics retrieved');
    console.log(`   Cache size: ${cacheStats.size}`);
    console.log(`   Cache keys: ${cacheStats.keys.length}\n`);

    console.log('🎉 All tests passed! Analytics module is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testAnalytics().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { testAnalytics }; 