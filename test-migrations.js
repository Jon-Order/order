import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import MigrationsManager from './db/migrations-manager.js';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable verbose logging for SQLite
sqlite3.verbose();

async function testMigrations() {
    let db;
    try {
        // Connect to test database with debug mode
        db = await open({
            filename: './test-orders.db',
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
        });
        
        // Enable foreign keys
        await db.run('PRAGMA foreign_keys = ON');
        
        logger.info('Connected to test SQLite database');
        
        // First, run the migrations table creation script
        const migrationTableSql = fs.readFileSync(
            path.join(__dirname, 'migrations', '001-migrations-table.sql'),
            'utf8'
        );
        logger.info('Read migrations table SQL:', migrationTableSql);
        
        try {
            await db.exec(migrationTableSql);
            logger.info('Created schema_migrations table');
        } catch (err) {
            logger.error('Error creating migrations table:', err);
            throw err;
        }
        
        // Initialize migrations manager
        const migrationsManager = new MigrationsManager(db, false);
        
        // List all files in migrations directory
        const allFiles = await fs.promises.readdir(path.join(__dirname, 'migrations'));
        logger.info('All files in migrations directory:', allFiles);
        
        // Get list of migration files
        const files = await migrationsManager.getMigrationFiles();
        logger.info('Found migration files:', files);
        
        // Check if migrations table exists
        const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'");
        logger.info('Migrations table exists:', !!tableExists);
        
        // Get applied migrations before running new ones
        try {
            const beforeMigrations = await db.all('SELECT * FROM schema_migrations ORDER BY version');
            logger.info('Migrations before running:', beforeMigrations);
        } catch (err) {
            logger.error('Error checking existing migrations:', err);
        }
        
        // Run migrations
        logger.info('Starting to run migrations...');
        try {
            await migrationsManager.runMigrations();
            logger.info('Finished running migrations');
        } catch (err) {
            logger.error('Error running migrations:', err);
            throw err;
        }
        
        // Verify migrations table exists and has records
        try {
            const migrations = await db.all('SELECT * FROM schema_migrations ORDER BY version');
            logger.info('Applied migrations:', migrations);
        } catch (err) {
            logger.error('Error checking applied migrations:', err);
        }
        
        // List all tables to verify schema
        try {
            const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
            logger.info('Created tables:', tables.map(t => t.name));
        } catch (err) {
            logger.error('Error listing tables:', err);
        }
        
        // Sample a few tables to verify their structure
        for (const table of ['owners', 'orders', 'order_lines']) {
            try {
                const columns = await db.all(`PRAGMA table_info(${table})`);
                logger.info(`Structure of ${table} table:`, columns.map(c => `${c.name} (${c.type})`));
            } catch (err) {
                logger.error(`Error checking table ${table}:`, err);
            }
        }
        
        logger.info('Migration test completed successfully');
    } catch (error) {
        logger.error('Migration test failed:', error);
        process.exit(1);
    } finally {
        if (db) {
            try {
                await db.close();
            } catch (err) {
                logger.error('Error closing database:', err);
            }
        }
    }
}

// Run the test
testMigrations().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
}); 