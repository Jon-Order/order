import { GlideAdapter } from './data-sources/glide-adapter.js';

async function testAdapterDirectly() {
  console.log('🧪 Testing GlideAdapter directly...\n');

  const config = {
    apiUrl: 'https://api.glideapp.io/api/function/queryTables',
    token: 'baa9a7c5-89f5-43b9-93e8-48a25be2cc33',
    appId: '5gyrohBpLyf0trjfoHsp',
    orderLinesTableName: 'native-table-efbe8bf7-3e63-4734-9e3b-f8b56ae718f3',
    timeout: 30000
  };

  const adapter = new GlideAdapter(config);

  try {
    console.log('Testing connection...');
    const isValid = await adapter.validateConnection();
    console.log('Connection valid:', isValid);

    if (isValid) {
      console.log('\nTesting fetchItems...');
      const items = await adapter.fetchItems();
      console.log('Items count:', items.length);

      console.log('\nTesting fetchOrders...');
      const orders = await adapter.fetchOrders();
      console.log('Orders count:', orders.length);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testAdapterDirectly(); 