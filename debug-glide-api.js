import fetch from 'node-fetch';

async function testGlideAPI() {
  console.log('🧪 Testing Glide API directly...\n');

  const body = {
    appID: "5gyrohBpLyf0trjfoHsp",
    queries: [
      {
        tableName: "native-table-efbe8bf7-3e63-4734-9e3b-f8b56ae718f3",
        utc: true
      }
    ]
  };

  console.log('Request body:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch('https://api.glideapp.io/api/function/queryTables', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer baa9a7c5-89f5-43b9-93e8-48a25be2cc33',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Success! Response structure:', Object.keys(result));
    
    if (result[0] && result[0].rows) {
      console.log(`Found ${result[0].rows.length} rows`);
      if (result[0].rows.length > 0) {
        console.log('Sample row:', result[0].rows[0]);
      }
    } else {
      console.log('No rows found or unexpected structure:', result);
    }

  } catch (error) {
    console.error('❌ API call failed:', error.message);
  }
}

testGlideAPI(); 