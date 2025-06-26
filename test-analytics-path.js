import { dataSourceFactory } from './data-sources/adapter-factory.js';

async function testAnalyticsPath() {
  console.log('🧪 Testing the exact analytics service path...\n');

  try {
    // Step 1: Get adapter through factory (same as analytics service)
    console.log('1. Getting adapter through factory...');
    const adapter = await dataSourceFactory.getAdapter();
    console.log('✅ Adapter created:', adapter.name);

    // Step 2: Test connection
    console.log('\n2. Testing connection...');
    const isValid = await adapter.validateConnection();
    console.log('✅ Connection valid:', isValid);

    if (isValid) {
      // Step 3: Test fetchItems (same as analytics service)
      console.log('\n3. Testing fetchItems...');
      const items = await adapter.fetchItems({ limit: 1000 });
      console.log('✅ Items fetched:', items.length);

      // Step 4: Test fetchOrders (same as analytics service)
      console.log('\n4. Testing fetchOrders...');
      const orders = await adapter.fetchOrders({ limit: 1000 });
      console.log('✅ Orders fetched:', orders.length);

      console.log('\n🎉 All tests passed! The issue is not in the adapter or factory.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAnalyticsPath(); 