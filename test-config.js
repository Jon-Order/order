import 'dotenv/config';
import { DATA_SOURCES } from './core/config/data-sources.js';

console.log('🔍 Testing Configuration Loading...\n');

console.log('Environment Variables:');
console.log('  GLIDE_API_URL:', process.env.GLIDE_API_URL);
console.log('  GLIDE_API_TOKEN:', process.env.GLIDE_API_TOKEN ? 'SET' : 'NOT SET');
console.log('  GLIDE_APP_ID:', process.env.GLIDE_APP_ID);
console.log('  GLIDE_ORDER_LINES_TABLE_NAME:', process.env.GLIDE_ORDER_LINES_TABLE_NAME);

console.log('\nDATA_SOURCES Configuration:');
console.log('  Current:', DATA_SOURCES.current);
console.log('  Glide Config:', DATA_SOURCES.glide); 