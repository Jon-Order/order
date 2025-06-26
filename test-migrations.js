import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { MigrationsManager } from './db/migrations-manager.js';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable verbose logging for SQLite
sqlite3.verbose();

async function getTestDb() {
    return await open({
        filename: ':memory:',
        driver: sqlite3.Database
    });
}

async function resetMigrationsTable(db) {
    try {
        await db.run('DROP TABLE IF EXISTS schema_migrations');
        logger.info('Reset migrations table');
    } catch (error) {
        logger.error('Error resetting migrations table:', error);
        throw error;
    }
}

async function testMigrations() {
    let db;
    try {
        db = await getTestDb();
        logger.info('Connected to test SQLite database');

        // Reset migrations table if RESET_MIGRATIONS environment variable is set
        if (process.env.RESET_MIGRATIONS) {
            await resetMigrationsTable(db);
        }

        const migrationsManager = new MigrationsManager(db, false);
        await migrationsManager.runMigrations();
        logger.info('Migration test completed successfully');
    } catch (error) {
        logger.error('Migration test failed:', error);
        process.exit(1);
    } finally {
        if (db) {
            await db.close();
        }
    }
}

// Run the test
testMigrations().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
}); 