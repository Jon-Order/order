import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import MigrationsManager from './db/migrations-manager.js';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function mockTestEnvironment() {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'sqlite://:memory:';
}

async function testMigrations() {
    console.log('Testing migrations...');
    
    try {
        // Initialize database
        await db.initializeDatabase();
        console.log('✓ Database initialized');
        
        // Get database instance
        const dbInstance = await db.getDb();
        console.log('✓ Database instance obtained');
        
        // Create migrations manager
        const migrationsManager = new MigrationsManager(dbInstance, false);
        console.log('✓ MigrationsManager created');
        
        // Run migrations
        await migrationsManager.runMigrations();
        console.log('✓ Migrations completed successfully');
        
        return true;
    } catch (error) {
        console.error('❌ Migration test failed:', error);
        return false;
    }
}

async function testImports() {
    console.log('\nTesting imports...');
    
    try {
        // Test importing MigrationsManager
        const dbInstance = await db.getDb();
        const manager = new MigrationsManager(dbInstance, false);
        console.log('✓ MigrationsManager imported successfully');
        
        return true;
    } catch (error) {
        console.error('❌ Import test failed:', error);
        return false;
    }
}

async function main() {
    console.log('Starting deployment tests...\n');
    
    try {
        // Mock test environment
        await mockTestEnvironment();
        console.log('✓ Test environment mocked');
        
        // Run tests
        const importsPassed = await testImports();
        const migrationsPassed = await testMigrations();
        
        if (importsPassed && migrationsPassed) {
            console.log('\n✨ All deployment tests passed!');
            process.exit(0);
        } else {
            console.error('\n❌ Some tests failed');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Test run failed:', error);
        process.exit(1);
    }
}

main(); 