-- Create base tables with PostgreSQL compatible types
CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    require_sign_offs BOOLEAN DEFAULT FALSE,
    restrict_par_access BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    contact_name TEXT,
    phone TEXT,
    min_order_value REAL,
    order_days TEXT,
    order_cutoff TEXT,
    delivery_arrangement TEXT,
    delivery_days TEXT,
    active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    owner_id TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    postcode TEXT,
    phone TEXT,
    email TEXT,
    active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    brand_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS skus (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    product_code TEXT,
    unit TEXT,
    cost REAL,
    notes TEXT,
    supplier_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS sku_masks (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    par_level REAL,
    preset_order_qty REAL,
    pinned BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (sku_id) REFERENCES skus(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT,
    active BOOLEAN DEFAULT TRUE,
    brand_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    user_pin TEXT CHECK(length(user_pin) <= 4),
    image TEXT,
    base_location_id TEXT,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (owner_id) REFERENCES owners(id),
    FOREIGN KEY (base_location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_date DATE NOT NULL,
    status TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    supplier_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_lines (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    sku_id TEXT NOT NULL,
    quantity REAL,
    cpu REAL,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (sku_id) REFERENCES skus(id)
);

CREATE TABLE IF NOT EXISTS supplier_mask (
    id TEXT PRIMARY KEY,
    loc_id TEXT,
    supplier_id TEXT,
    owner_id TEXT,
    supplier_name TEXT,
    notes TEXT,
    account_id TEXT,
    team TEXT,
    active BOOLEAN DEFAULT TRUE,
    order_days TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create webhook events table with auto-incrementing ID
CREATE TABLE IF NOT EXISTS create_order_webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TIMESTAMP NOT NULL,
    payload TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP
); 