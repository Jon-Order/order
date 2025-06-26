import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import logger from './logger.js';
import { monitoring } from './monitoring.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

async function initializeDatabase() {
    if (isProd) {
        // PostgreSQL setup for production
        pgPool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Required for Render's PostgreSQL
            }
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

// Generic query function that works with both databases
async function query(sql, params = []) {
    if (isProd) {
        const { text, values } = convertParams(sql, params);
        const client = await pgPool.connect();
        try {
            const result = await client.query(text, values);
            return result.rows;
        } finally {
            client.release();
        }
    } else {
        return db.all(sql, params);
    }
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

// Generic run function that works with both databases
async function run(sql, params = []) {
    if (isProd) {
        const { text, values } = convertParams(sql, params);
        const client = await pgPool.connect();
        try {
            const result = await client.query(text, values);
            return { changes: result.rowCount };
        } finally {
            client.release();
        }
    } else {
        return db.run(sql, params);
    }
}

// Initialize database connection
initializeDatabase().catch(err => {
    logger.error('Database initialization failed:', err);
    process.exit(1);
});

// Create orders table if it doesn't exist
async function setupDatabase() {
    const db = await getDb();
    
    // Orders table
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

    // Analytics results table
    await db.run(`
        CREATE TABLE IF NOT EXISTS analytics_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            item_name TEXT,
            supplier_id TEXT,
            analysis_date TEXT NOT NULL,
            source TEXT,
            analysis_type TEXT,
            metrics TEXT,
            breakdowns TEXT,
            metadata TEXT,
            UNIQUE(item_id, analysis_date)
        )
    `);

    // Order lines table
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
            created_at TEXT,
            updated_at TEXT
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

// Initialize database
await setupDatabase();

// Database operations
async function createOrder(order) {
    const db = await getDb();
    const now = new Date().toISOString();
    
    try {
        await db.run('BEGIN TRANSACTION');
        
        // Use REPLACE INTO to handle duplicates
        await db.run(
            `REPLACE INTO orders (
                id, local_order_id, order_date, status, supplier_id, 
                location_id, created_by, trial_rating, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order.id,
                order.id, // local_order_id is same as id
                order.order_date,
                order.status,
                order.supplier_id,
                order.location_id,
                order.created_by,
                order.trial_rating,
                order.created_at || now,
                now
            ]
        );
        
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
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
    const db = await getDb();
    const now = new Date().toISOString();
    return db.run(
        'INSERT INTO create_order_webhook_events (received_at, payload) VALUES (?, ?)',
        [now, JSON.stringify(payload)]
    );
}

// Get all unprocessed webhook events
async function getUnprocessedWebhookEvents() {
    const db = await getDb();
    return db.all(
        'SELECT * FROM create_order_webhook_events WHERE processed = 0 ORDER BY received_at ASC'
    );
}

// Mark a webhook event as processed
async function markWebhookEventProcessed(eventId) {
    const db = await getDb();
    const now = new Date().toISOString();
    return db.run(
        'UPDATE create_order_webhook_events SET processed = 1, processed_at = ? WHERE id = ?',
        [now, eventId]
    );
}

// Insert a full snapshot order line into the order_lines table
async function createOrderLine(line) {
    const db = await getDb();
    
    try {
        await db.run('BEGIN TRANSACTION');
        
        // Use REPLACE INTO to handle duplicates
        await db.run(
            `REPLACE INTO order_lines (
                id, order_id, sku_id, product_code, product_name,
                quantity, cost, unit, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                line.id,
                line.order_id,
                line.sku_id,
                line.product_code,
                line.product_name,
                line.quantity,
                line.cost,
                line.unit,
                line.created_at,
                line.created_at // Use created_at as updated_at for new lines
            ]
        );
        
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

// Fetch all locations (id and name)
const getAllLocations = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, name FROM locations', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// Fetch all suppliers (id and name)
const getAllSuppliers = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, name FROM suppliers', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// Fetch all users (id and name)
const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, name FROM users', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// Fetch all locations with brand name
const getAllLocationsWithBrand = () => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT locations.id, locations.name, locations.brand_id, brands.name AS brand_name
            FROM locations
            LEFT JOIN brands ON locations.brand_id = brands.id
        `;
        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// Fetch order lines for a given order_id, only where quantity > 0
const getOrderLinesByOrderId = (orderId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT quantity, unit, product_name, product_code
            FROM order_lines
            WHERE order_id = ? AND quantity > 0
        `;
        db.all(sql, [orderId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// Export all functions
export {
    query,
    get,
    run,
    initializeDatabase,
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
    createOrderLine,
    getAllLocations,
    getAllSuppliers,
    getAllUsers,
    getAllLocationsWithBrand,
    getOrderLinesByOrderId,
    getOrdersByStatus,
    updateOrderStatus,
    getOrderLines,
    createWebhookEvent,
    getWebhookEventById,
    updateWebhookEvent,
    deleteWebhookEvent
}; 