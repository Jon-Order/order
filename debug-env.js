import 'dotenv/config';

console.log('--- Environment Variable Debugger ---');
console.log('Attempting to read variables from .env file...');
console.log('');

console.log(`GLIDE_API_TOKEN: ${process.env.GLIDE_API_TOKEN}`);
console.log(`GLIDE_APP_ID: ${process.env.GLIDE_APP_ID}`);
console.log(`GLIDE_ORDER_LINES_TABLE_NAME: ${process.env.GLIDE_ORDER_LINES_TABLE_NAME}`);
console.log('');

console.log('--- Debug Complete ---'); 