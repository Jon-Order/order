import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import logger from './logger.js';
import { monitoring } from './shared/monitoring/index.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { MigrationsManager } from './db/migrations-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backup directory
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

// Database file path
const dbPath = path.join(__dirname, 'orders.db');

let db;
let pgPool;

const isProd = process.env.NODE_ENV === 'production';

// Initialize database connection
export async function initializeDatabase() {
    if (isProd) {
        // PostgreSQL setup for production
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is required in production');
        }

        pgPool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Required for Render's PostgreSQL
            },
            // Add some reasonable defaults for a production environment
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        });
        
        try {
            // Test the connection
            const client = await pgPool.connect();
            logger.info('Connected to PostgreSQL database');
            client.release();
        } catch (err) {
            logger.error('Failed to connect to PostgreSQL:', err);
            throw err;
        }
    } else {
        // SQLite setup for development
        try {
            db = await open({
                filename: './orders.db',
                driver: sqlite3.Database
            });
            logger.info('Connected to SQLite database');
        } catch (err) {
            logger.error('Failed to connect to SQLite:', err);
            throw err;
        }
    }
}

// Run database migrations
export async function runMigrations() {
    const migrationsManager = new MigrationsManager(isProd ? pgPool : db, isProd);
    await migrationsManager.runMigrations();
}

// Query wrapper that works with both SQLite and PostgreSQL
export async function query(sql, params = []) {
    if (isProd) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            client.release();
        }
    } else {
        return db.all(sql, params);
    }
}

// Run wrapper that works with both SQLite and PostgreSQL
export async function run(sql, params = []) {
    if (isProd) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(sql, params);
            return result;
        } finally {
            client.release();
        }
    } else {
        return db.run(sql, params);
    }
}

// Helper function to convert SQLite parameters to PostgreSQL
function convertParams(query, params) {
    if (!isProd) return { text: query, values: params };
    
    let pgIndex = 1;
    const pgParams = [];
    const pgQuery = query.replace(/\?/g, () => {
        pgParams.push(params[pgIndex - 1]);
        return `$${pgIndex++}`;
    });
    
    return { text: pgQuery, values: pgParams };
}

// Generic get function that works with both databases
async function get(sql, params = []) {
    if (isProd) {
        const { text, values } = convertParams(sql, params);
        const client = await pgPool.connect();
        try {
            const result = await client.query(text, values);
            return result.rows[0];
        } finally {
            client.release();
        }
    } else {
        return db.get(sql, params);
    }
}

// Get database instance
async function getDb() {
    if (isProd) {
        return {
            run: async (sql, params = []) => {
                const { text, values } = convertParams(sql, params);
                const client = await pgPool.connect();
                try {
                    const result = await client.query(text, values);
                    return { changes: result.rowCount };
                } finally {
                    client.release();
                }
            },
            all: async (sql, params = []) => {
                const { text, values } = convertParams(sql, params);
                const client = await pgPool.connect();
                try {
                    const result = await client.query(text, values);
                    return result.rows;
                } finally {
                    client.release();
                }
            },
            get: async (sql, params = []) => {
                const { text, values } = convertParams(sql, params);
                const client = await pgPool.connect();
                try {
                    const result = await client.query(text, values);
                    return result.rows[0];
                } finally {
                    client.release();
                }
            }
        };
    } else {
        return db;
    }
}

// Create orders table if it doesn't exist
async function setupDatabase() {
    if (isProd) {
        // Run PostgreSQL migrations
        const migrationFiles = ['003-fix-postgres-autoincrement.sql'];
        for (const migrationFile of migrationFiles) {
            const migrationPath = path.join(__dirname, 'migrations', migrationFile);
            try {
                const migration = fs.readFileSync(migrationPath, 'utf8');
                const client = await pgPool.connect();
                try {
                    await client.query(migration);
                    logger.info(`Successfully ran migration: ${migrationFile}`);
                } finally {
                    client.release();
                }
            } catch (err) {
                logger.error(`Error running migration ${migrationFile}:`, err);
                throw err; // We want to fail if migrations fail
            }
        }
        return; // Exit early for production
    }

    // SQLite setup for development only
    await db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            local_order_id TEXT,
            order_date TEXT,
            status TEXT,
            supplier_id TEXT,
            location_id TEXT,
            created_by TEXT,
            trial_rating TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);

    // Analytics results table for SQLite
    await db.run(`
        CREATE TABLE IF NOT EXISTS analytics_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            total_quantity INTEGER NOT NULL,
            average_quantity REAL NOT NULL,
            order_count INTEGER NOT NULL,
            first_order_date TEXT,
            last_order_date TEXT,
            min_quantity INTEGER,
            max_quantity INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Order lines table for SQLite
    await db.run(`
        CREATE TABLE IF NOT EXISTS order_lines (
            id TEXT PRIMARY KEY,
            order_id TEXT,
            product_code TEXT,
            product_name TEXT,
            quantity REAL,
            cost REAL,
            unit TEXT,
            supplier_id TEXT,
            location_id TEXT,
            sku TEXT,
            sku_name TEXT,
            pack_size INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Webhook events table
    await db.run(`
        CREATE TABLE IF NOT EXISTS create_order_webhook_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at TEXT,
            payload TEXT,
            processed INTEGER DEFAULT 0,
            processed_at TEXT
        )
    `);

    logger.info('Database schema is up to date');
}

// Helper function for transactions
async function withTransaction(callback) {
    if (isProd) {
        const client = await pgPool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } else {
        try {
            await db.run('BEGIN TRANSACTION');
            const result = await callback(db);
            await db.run('COMMIT');
            return result;
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    }
}

// Insert a full snapshot order line into the order_lines table
async function createOrderLine(line) {
    return withTransaction(async (dbClient) => {
        const timestamp = new Date().toISOString();
        const sql = isProd 
            ? `INSERT INTO order_lines (
                id, order_id, sku_id, product_code, product_name,
                quantity, cost, unit, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
            : `REPLACE INTO order_lines (
                id, order_id, sku_id, product_code, product_name,
                quantity, cost, unit, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [
            line.id,
            line.order_id,
            line.sku_id,
            line.product_code,
            line.product_name,
            line.quantity,
            line.cost,
            line.unit,
            timestamp,
            timestamp
        ];

        if (isProd) {
            await dbClient.query(sql, params);
        } else {
            await dbClient.run(sql, params);
        }
    });
}

// Create a new order
async function createOrder(order) {
    return withTransaction(async (dbClient) => {
        const timestamp = new Date().toISOString();
        const sql = isProd
            ? `INSERT INTO orders (
                id, supplier_id, order_date, status, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6)`
            : `INSERT INTO orders (
                id, supplier_id, order_date, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)`;
        
        const params = [
            order.id,
            order.supplier_id,
            order.order_date,
            order.status,
            timestamp,
            timestamp
        ];

        if (isProd) {
            await dbClient.query(sql, params);
        } else {
            await dbClient.run(sql, params);
        }
    });
}

async function getOrderById(orderId) {
    const db = await getDb();
    const startTime = Date.now();
    
    try {
        const row = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
        monitoring.trackResponseTime(Date.now() - startTime);
        return row || null;
    } catch (err) {
        monitoring.trackFailedOperation();
        throw err;
    }
}

async function getSupplierOrders(supplierId) {
    const db = await getDb();
    const startTime = Date.now();
    
    try {
        const rows = await db.all('SELECT * FROM orders WHERE supplier_id = ? ORDER BY created_at DESC', [supplierId]);
        monitoring.trackResponseTime(Date.now() - startTime);
        return rows || [];
    } catch (err) {
        monitoring.trackFailedOperation();
        throw err;
    }
}

async function getAllOrders() {
    const db = await getDb();
    const startTime = Date.now();
    
    try {
        const rows = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
        monitoring.trackResponseTime(Date.now() - startTime);
        return rows || [];
    } catch (err) {
        monitoring.trackFailedOperation(err);
        throw err;
    }
}

// Backup function
const backupDatabase = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `orders-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Database backed up to ${backupPath}`);
    monitoring.setLastBackupTime(new Date());
};

// Function to store analytics results
const storeAnalyticsResults = async (results) => {
    const stmt = db.prepare(`
        INSERT INTO analytics_results (item_id, analysis_date, source, analysis_type, metrics, breakdowns, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(item_id, analysis_date) DO UPDATE SET
          source=excluded.source,
          analysis_type=excluded.analysis_type,
          metrics=excluded.metrics,
          breakdowns=excluded.breakdowns,
          metadata=excluded.metadata
    `);

    let storedCount = 0;
    for (const item of results) {
        const dbFormat = item.toDatabaseFormat();
        stmt.run(
            dbFormat.item_id,
            dbFormat.analysis_date,
            dbFormat.source,
            dbFormat.analysis_type,
            dbFormat.metrics,
            dbFormat.breakdowns,
            dbFormat.metadata,
            (err) => {
                if (err) {
                    logger.error('Failed to store analytics result', { error: err.message });
                    return;
                }
                storedCount++;
                if (storedCount === results.length) {
                    stmt.finalize();
                    logger.info(`Successfully stored ${storedCount} analytics results.`);
                }
            }
        );
    }
};

// Function to get latest analytics for all items
const getLatestAnalytics = async () => {
    const query = `
        SELECT a.*
        FROM analytics_results a
        INNER JOIN (
            SELECT item_id, MAX(analysis_date) as max_date
            FROM analytics_results
            GROUP BY item_id
        ) b ON a.item_id = b.item_id AND a.analysis_date = b.max_date
    `;

    return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
            if (err) {
                logger.error('Error fetching latest analytics', { error: err.message });
                return reject(err);
            }
            resolve(rows.map(row => ({
                ...row,
                metrics: JSON.parse(row.metrics),
                metadata: JSON.parse(row.metadata)
            })));
        });
    });
};

// Utility: List all user tables
const listTables = () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(r => r.name));
        });
    });
};

// Utility: Count rows in a table
const countRows = (table) => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
            if (err) return reject(err);
            resolve(row.count);
        });
    });
};

// Utility: Get most recent 100 rows from a table (by rowid desc)
const getRecentRows = (table) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 100`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// Insert a webhook event into the staging table
async function insertWebhookEvent(payload) {
    const sql = `
        INSERT INTO webhook_events (payload)
        VALUES (?)
        RETURNING id
    `;
    const result = await run(sql, [JSON.stringify(payload)]);
    return result.lastID || result.rows[0].id;
}

// Get all unprocessed webhook events
async function getUnprocessedWebhookEvents() {
    const sql = `
        SELECT * FROM webhook_events
        WHERE processed = FALSE
        ORDER BY received_at ASC
        LIMIT 100
    `;
    return await query(sql);
}

// Mark a webhook event as processed
async function markWebhookEventProcessed(eventId, error = null) {
    const sql = `
        UPDATE webhook_events
        SET processed = TRUE,
            processed_at = CURRENT_TIMESTAMP,
            error = ?
        WHERE id = ?
    `;
    await run(sql, [error, eventId]);
}

// Fetch all locations (id and name)
async function getAllLocations() {
    if (isProd) {
        const result = await query('SELECT id, name FROM locations');
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM locations', [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

// Fetch all suppliers (id and name)
async function getAllSuppliers() {
    if (isProd) {
        const result = await query('SELECT id, name FROM suppliers');
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM suppliers', [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

// Fetch all users (id and name)
async function getAllUsers() {
    if (isProd) {
        const result = await query('SELECT id, name FROM users');
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM users', [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

// Fetch all locations with brand name
async function getAllLocationsWithBrand() {
    const sql = `
        SELECT locations.id, locations.name, locations.brand_id, brands.name AS brand_name
        FROM locations
        LEFT JOIN brands ON locations.brand_id = brands.id
    `;
    if (isProd) {
        const result = await query(sql);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

// Fetch order lines for a given order_id, only where quantity > 0
async function getOrderLinesByOrderId(orderId) {
    const sql = `
        SELECT quantity, unit, product_name, product_code
        FROM order_lines
        WHERE order_id = $1 AND quantity > 0
    `;
    if (isProd) {
        const result = await query(sql, [orderId]);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all('SELECT quantity, unit, product_name, product_code FROM order_lines WHERE order_id = ? AND quantity > 0', 
                [orderId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
        });
    }
}

// Webhook functions
async function createWebhookEvent(event) {
    const sql = `
        INSERT INTO webhook_events (id, event_type, payload, processed)
        VALUES (?, ?, ?, ?)
    `;
    return run(sql, [event.id, event.event_type, JSON.stringify(event.payload), false]);
}

async function getWebhookEventById(id) {
    const sql = 'SELECT * FROM webhook_events WHERE id = ?';
    return get(sql, [id]);
}

async function updateWebhookEvent(id, updates) {
    const sql = `
        UPDATE webhook_events
        SET processed = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    return run(sql, [updates.processed, id]);
}

async function deleteWebhookEvent(id) {
    const sql = 'DELETE FROM webhook_events WHERE id = ?';
    return run(sql, [id]);
}

// Export all functions
export {
    get,
    getDb,
    setupDatabase,
    withTransaction,
    createOrderLine,
    createOrder,
    getOrderById,
    getSupplierOrders,
    getAllOrders,
    backupDatabase,
    storeAnalyticsResults,
    getLatestAnalytics,
    listTables,
    countRows,
    getRecentRows,
    insertWebhookEvent,
    getUnprocessedWebhookEvents,
    markWebhookEventProcessed,
    getAllLocations,
    getAllSuppliers,
    getAllUsers,
    getAllLocationsWithBrand,
    getOrderLinesByOrderId,
    createWebhookEvent,
    getWebhookEventById,
    updateWebhookEvent,
    deleteWebhookEvent
}; 