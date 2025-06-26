-- Initialize the database schema

-- Orders table
CREATE TABLE IF NOT EXISTS "orders" (
    id TEXT PRIMARY KEY,
    local_order_id TEXT UNIQUE,
    order_date DATE NOT NULL,
    status TEXT,
    supplier_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    trial_rating INTEGER,
    created_at TEXT,
    updated_at TEXT
);

-- Order lines table
CREATE TABLE IF NOT EXISTS "order_lines" (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_code TEXT,
    product_name TEXT,
    quantity REAL NOT NULL,
    cost REAL,
    unit TEXT,
    created_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Order events table for tracking status changes and actions
CREATE TABLE IF NOT EXISTS "order_events" (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- e.g., 'created', 'submitted', 'sent', 'received', 'confirmed', 'supplier_confirmed'
    user_id TEXT NOT NULL,     -- ID of the user who triggered the event
    user_name TEXT,            -- Name of the user (if available)
    location_id TEXT,          -- Location where the event occurred
    signature TEXT,            -- Digital signature if applicable
    metadata TEXT,             -- JSON field for additional event-specific data
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Webhook events table
CREATE TABLE IF NOT EXISTS "webhook_events" (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    created_at TEXT,
    processed_at TEXT
);

-- Analytics results table
CREATE TABLE IF NOT EXISTS "analytics_results" (
    id TEXT PRIMARY KEY,
    result_type TEXT NOT NULL,
    result_data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
); 