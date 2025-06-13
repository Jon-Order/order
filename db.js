import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './logger.js';
import { monitoring } from './monitoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backup directory
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

// Database file path
const dbPath = path.join(__dirname, 'orders.db');

// Initialize SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
    console.log('Connected to SQLite database');
});

// Create orders table if it doesn't exist
const initializeDatabase = async () => {
    try {
        await new Promise((resolve, reject) => {
            db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'", (err, result) => {
                if (err) {
                    monitoring.trackFailedOperation(err);
                    reject(err);
                    return;
                }

                if (!result) {
                    console.log('Creating orders table...');
                    const createTableSQL = `
                        CREATE TABLE orders (
                            id TEXT PRIMARY KEY,
                            restaurant_id TEXT,
                            supplier_id TEXT,
                            supplier_name TEXT,
                            location_name TEXT,
                            status TEXT DEFAULT 'pending',
                            created_by TEXT,
                            timestamp TEXT,
                            order_date TEXT,
                            csv_url TEXT,
                            supplier_email TEXT,
                            supplier_phone TEXT,
                            metadata TEXT
                        )
                    `;
                    
                    db.run(createTableSQL, (err) => {
                        if (err) {
                            monitoring.trackFailedOperation(err);
                            reject(err);
                        } else {
                            console.log('Orders table initialized');
                            resolve();
                        }
                    });
                } else {
                    // Check if we need to add new columns
                    const alterTableCommands = [
                        "ALTER TABLE orders ADD COLUMN order_date TEXT;",
                        "ALTER TABLE orders ADD COLUMN csv_url TEXT;",
                        "ALTER TABLE orders ADD COLUMN supplier_email TEXT;",
                        "ALTER TABLE orders ADD COLUMN supplier_phone TEXT;"
                    ];
                    
                    const runAlterCommands = async () => {
                        for (const command of alterTableCommands) {
                            try {
                                await new Promise((res, rej) => {
                                    db.run(command, (err) => {
                                        if (err && !err.message.includes('duplicate column')) {
                                            rej(err);
                                        } else {
                                            res();
                                        }
                                    });
                                });
                            } catch (error) {
                                console.error('Error adding column:', error);
                            }
                        }
                    };
                    
                    runAlterCommands()
                        .then(() => {
                            console.log('Orders table schema is up to date');
                            resolve();
                        })
                        .catch(err => {
                            console.error('Error updating schema:', err);
                            reject(err);
                        });
                }
            });
        });
    } catch (error) {
        console.error('Error initializing database:', error);
        monitoring.trackFailedOperation(error);
        throw error;
    }
};

// Initialize database
await initializeDatabase();

// Database operations
const createOrder = (order) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const sql = `
            INSERT INTO orders (
                id, restaurant_id, supplier_id, supplier_name, 
                location_name, status, created_by, timestamp,
                order_date, csv_url, supplier_email, supplier_phone,
                metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            order.id,
            order.restaurant_id || null,
            order.supplier_id,
            order.supplier_name,
            order.location_name,
            order.status || 'pending',
            order.created_by,
            order.timestamp,
            order.order_date || null,
            order.csv_url || null,
            order.supplier_email || null,
            order.supplier_phone || null,
            JSON.stringify(order.metadata || {})
        ];
        
        db.run(sql, values, function(err) {
            monitoring.trackResponseTime(Date.now() - startTime);
            if (err) {
                monitoring.trackFailedOperation(err);
                reject(err);
            } else {
                resolve(order);
            }
        });
    });
};

const getOrderById = (orderId) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const sql = 'SELECT * FROM orders WHERE id = ?';
        db.get(sql, [orderId], (err, row) => {
            monitoring.trackResponseTime(Date.now() - startTime);
            if (err) {
                monitoring.trackFailedOperation();
                reject(err);
            } else if (!row) {
                resolve(null);
            } else {
                try {
                    row.metadata = JSON.parse(row.metadata);
                } catch (e) {
                    row.metadata = {};
                }
                resolve(row);
            }
        });
    });
};

const getSupplierOrders = (supplierId) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const sql = 'SELECT * FROM orders WHERE supplier_id = ? ORDER BY timestamp DESC';
        db.get(sql, [supplierId], (err, rows) => {
            monitoring.trackResponseTime(Date.now() - startTime);
            if (err) {
                monitoring.trackFailedOperation();
                reject(err);
            } else {
                rows = rows || [];
                rows.forEach(row => {
                    try {
                        row.metadata = JSON.parse(row.metadata);
                    } catch (e) {
                        row.metadata = {};
                    }
                });
                resolve(rows);
            }
        });
    });
};

const getAllOrders = () => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const sql = 'SELECT * FROM orders ORDER BY timestamp DESC';
        db.all(sql, [], (err, rows) => {
            monitoring.trackResponseTime(Date.now() - startTime);
            if (err) {
                monitoring.trackFailedOperation(err);
                reject(err);
            } else {
                rows = rows || [];
                rows.forEach(row => {
                    try {
                        row.metadata = JSON.parse(row.metadata);
                    } catch (e) {
                        row.metadata = {};
                    }
                });
                resolve(rows);
            }
        });
    });
};

// Backup function
const backupDatabase = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `orders-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Database backed up to ${backupPath}`);
    monitoring.setLastBackupTime(new Date());
};

// Export database operations and monitoring
export default {
    createOrder,
    getOrderById,
    getSupplierOrders,
    getAllOrders,
    monitoring
}; 