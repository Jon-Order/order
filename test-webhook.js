import fetch from 'node-fetch';

// Test data (use your actual values)
const testOrder = {
  "order_id": "BfdH531TTjNf6P38TVX2",
  "supplier_id": "Ex7AoBjaSbaWlVnxUFILog",
  "supplier_mask": "Ex7AoBjaSbaWlVnxUFILog",
  "location_mask": "XeZhAwMCQoGJ44LxPjFvuQ",
  "user_id": "N3AjDfQHRTyGWXiecZl7Ew",
  "supplier_name": "Demo Supplier",
  "location_name": "Demo Location"
};

async function testWebhook() {
  try {
    console.log('Testing webhook...');
    
    const response = await fetch('http://localhost:3000/webhook/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOrder)
    });
    
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run test if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testWebhook();
}

export { testWebhook, testOrder }; 