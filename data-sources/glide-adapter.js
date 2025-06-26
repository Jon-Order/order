import { DataSourceAdapter } from './base-adapter.js';
import fetch from 'node-fetch';

export class GlideAdapter extends DataSourceAdapter {
  constructor(config) {
    super(config);
    this.endpoint = config.apiUrl;
    this.token = config.token;
    this.appId = config.appId;
    this.orderLinesTableName = config.orderLinesTableName;
    this.ordersTableName = config.ordersTableName;
    this.timeout = config.timeout || 30000;

    // Internal cache to avoid redundant API calls within a single analytics run
    this._cachedOrderLines = null;
  }

  // Fetches and processes the raw order line data from Glide.
  async _fetchAndProcessOrderLines(orderId = null, offset = 0, limit = 1000) {
    console.log('DEBUG: _fetchAndProcessOrderLines called with orderId:', orderId);
    
    // Clear cache to ensure fresh request
    this._cachedOrderLines = null;

    const query = {
      tableName: this.orderLinesTableName,
      utc: true,
      offset: offset,
      limit: limit
    };

    const body = {
      appID: this.appId,
      queries: [query]
    };

    const requestLog = `OrderId: ${orderId}\nGlide API request body: ${JSON.stringify(body, null, 2)}\n`;
    console.log('DEBUG: Glide API request body:', JSON.stringify(body, null, 2));
    
    try {
      const fs = await import('fs');
      fs.appendFileSync('glide-api-request.log', requestLog);
    } catch (e) {
      console.error('Failed to write to glide-api-request.log:', e);
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      timeout: this.timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Glide API error: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const json = await response.json();
    const rawRows = json[0].rows;
    const numRows = rawRows ? rawRows.length : 0;
    console.log('DEBUG: Number of rows returned from Glide:', numRows);
    if (rawRows && rawRows.length > 0) {
      console.log('DEBUG: First 3 rows from Glide:', JSON.stringify(rawRows.slice(0, 3), null, 2));
    }

    if (!rawRows || rawRows.length === 0) {
      return [];
    }

    const mappedOrderLines = rawRows.map(row => {
      const skuId = row['Name'];
      if (!skuId) {
        console.error('DEBUG: Missing SKU Row ID (Name) in Glide row:', row);
        return null;
      }
      
      console.log('DEBUG: SKU Row ID (Name) for order line:', skuId);
      
      return {
        order_id: row['DkAjz'], // Order ID
        sku_id: skuId, // SKU Row ID (from 'Name' column)
        quantity: row['xDa3g'] || 0, // Quantity
        cpu: row['wlY2L'] || 0, // Cost per unit
        product_code: row['PpduP'], // Product Code
        product_name: row['Xoe7X'], // Product Name
        created_at: row['1OGzY'], // Created timestamp
        updated_at: row['1OGzY'], // Use created_at as fallback
        supplier_id: row['hOyM7'], // Supplier ID (fixed naming)
        supplier_name: row['foEbv'] || 'Unknown', // Supplier Name
        unit: row['vszQ2'] || 'each', // Unit
        location_id: row['NmhEQ'] || null, // Location ID
      };
    }).filter(Boolean); // Remove any nulls from skipped rows

    if (mappedOrderLines.length > 0) {
      console.log('DEBUG: First mapped order line:', mappedOrderLines[0]);
    }

    console.log('DEBUG: Mapped order lines count:', mappedOrderLines.length);
    return mappedOrderLines;
  }

  // Validate connection to Glide API
  async validateConnection() {
    try {
      const lines = await this._fetchAndProcessOrderLines(null, 0, 1); // Just fetch 1 row for validation
      return Array.isArray(lines);
    } catch (error) {
      console.error('Glide API connection validation failed:', error.message);
      return false;
    }
  }

  // Extracts a unique list of items from the order lines with pagination support
  async fetchItems(options = {}) {
    return this.executeWithRetry(async () => {
      const { limit = 1000, offset = 0 } = options;
      const orderLines = await this._fetchAndProcessOrderLines(null, offset, limit);
      const itemsMap = new Map();

      orderLines.forEach(line => {
        if (!itemsMap.has(line.product_code)) {
          itemsMap.set(line.product_code, this.transformItem(line));
        }
      });

      return Array.from(itemsMap.values());
    });
  }

  // Groups order lines into orders with pagination support
  async fetchOrders(options = {}) {
    return this.executeWithRetry(async () => {
      const { limit = 1000, offset = 0 } = options;
      const orderLines = await this._fetchAndProcessOrderLines(null, offset, limit);
      const ordersMap = new Map();

      orderLines.forEach(line => {
        if (!ordersMap.has(line.order_id)) { // Fixed property name
          ordersMap.set(line.order_id, {
            id: line.order_id,
            external_id: line.order_id,
            source: 'glide',
            supplier_id: line.supplier_id,
            supplier_name: line.supplier_name,
            timestamp: line.created_at,
            items: []
          });
        }

        ordersMap.get(line.order_id).items.push({
          item_id: line.product_code,
          name: line.product_name,
          quantity: line.quantity,
          unit: line.unit,
          price: line.cpu,
          location_id: line.location_id,
          order_date: line.created_at
        });
      });

      return Array.from(ordersMap.values());
    });
  }

  // Transform a line into our standard item format
  transformItem(line) {
    return {
      id: line.product_code,
      external_id: line.sku_id, // Keep original Glide Row ID
      source: 'glide',
      name: line.product_name,
      supplier_id: line.supplier_id,
      category: line.category || 'Unknown', // Category not in data, can be added
      unit: line.unit,
      price: line.cpu,
      description: line.product_name,
      metadata: {
        glide_data: { ...line },
        last_synced: new Date().toISOString()
      }
    };
  }

  // Fetch item by ID - this will search across all items
  async fetchItemById(id) {
    // Since we need to find an item across all orders, we'll need to search
    // You might want to implement a more efficient search if your table supports it
    const items = await this.fetchItems({ limit: 10000 }); 
    return items.find(item => item.id === id);
  }

  // Fetch order from Glide orders table by ID
  async fetchOrderFromGlide(orderId) {
    console.log(`DEBUG: ========== Fetching order ==========`);
    console.log(`DEBUG: Requested orderId: ${orderId}`);
    console.log(`DEBUG: Using table: ${this.ordersTableName}`);
    
    const payload = {
      appID: this.appId,
      queries: [{
        tableName: this.ordersTableName,
        utc: true,
        filters: [{
          column: '$rowID',  // Search by Glide's row ID which matches webhook's order_id
          condition: 'is',
          value: orderId
        }]
      }]
    };
    
    console.log(`DEBUG: Making request to Glide API with payload:`, JSON.stringify(payload, null, 2));
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: this.timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Glide API error fetching order ${orderId}: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const json = await response.json();
    console.log(`DEBUG: Glide API response:`, JSON.stringify(json, null, 2));

    if (!json[0] || !json[0].rows || !json[0].rows.length) {
      console.log(`DEBUG: No order found in Glide for ID: ${orderId}`);
      return null;
    }

    const glideOrder = json[0].rows[0];
    console.log(`DEBUG: Order data before mapping:`, JSON.stringify(glideOrder, null, 2));
    return this._mapGlideOrderToOrder(glideOrder, orderId);
  }

  // Map Glide order data to our internal order format
  _mapGlideOrderToOrder(glideOrder, webhookOrderId) {
    console.log(`DEBUG: Mapping Glide order to internal format:`, JSON.stringify(glideOrder, null, 2));
    
    return {
      id: webhookOrderId,                // Use webhook's order_id
      local_order_id: glideOrder.RPpci,  // RPpci is the local order ID
      order_date: glideOrder['5i1Gh'],   // 5i1Gh is order_date
      status: glideOrder.nLIvg,          // nLIvg is status
      supplier_id: glideOrder.Name,       // Name is supplier_id
      created_by: glideOrder.u8fvO,      // u8fvO is created_by
      location_id: glideOrder.apPcv,     // apPcv is location_id
      trial_rating: glideOrder['3iK0x'],  // 3iK0x is trial_rating
      created_at: glideOrder.sfjAP       // sfjAP is created_at
    };
  }

  // Fetches a single order line by its Glide row ID
  async fetchOrderLineByRowId(rowId) {
    console.log(`\nDEBUG: ========== Fetching order line ==========`);
    console.log(`DEBUG: Requested rowId: ${rowId}`);
    console.log(`DEBUG: Using table: ${this.orderLinesTableName}`);
    
    // Extract table ID from the full table name (remove 'native-table-' prefix)
    const tableId = this.orderLinesTableName.replace('native-table-', '');
    const endpoint = `https://api.glideapps.com/tables/${tableId}/rows/${rowId}`;
    
    console.log(`DEBUG: Making request to Glide API endpoint:`, endpoint);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: this.timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Glide API error fetching row ${rowId}: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const json = await response.json();
    console.log(`DEBUG: Glide API response:`, JSON.stringify(json, null, 2));

    if (!json.data) {
      console.log(`DEBUG: No order line found for rowId: ${rowId}`);
      return null;
    }

    // Map the response data to our internal format
    const row = {
      $rowID: rowId,
      ...json.data
    };
    
    console.log(`DEBUG: Row data before mapping:`, JSON.stringify(row, null, 2));
    return this._mapGlideRowToOrderLine(row);
  }

  // Map Glide row data to our internal order line format
  _mapGlideRowToOrderLine(glideRow) {
    console.log(`DEBUG: ========== Mapping order line ==========`);
    console.log(`DEBUG: Raw Glide row:`, JSON.stringify(glideRow, null, 2));
    console.log(`DEBUG: SKU ID from Name field:`, glideRow.Name);
    console.log(`DEBUG: Row ID:`, glideRow.$rowID);
    console.log(`DEBUG: Order ID:`, glideRow.DkAjz);
    
    if (!glideRow.Name) {
      console.error(`ERROR: Missing SKU ID (Name field) in Glide row:`, JSON.stringify(glideRow, null, 2));
      throw new Error(`Missing SKU ID (Name field) in Glide row ${glideRow.$rowID}`);
    }
    
    // Ensure SKU ID is a valid string
    const skuId = String(glideRow.Name).trim();
    if (!skuId) {
      console.error(`ERROR: Invalid SKU ID (empty after trim) in Glide row:`, JSON.stringify(glideRow, null, 2));
      throw new Error(`Invalid SKU ID (empty after trim) in Glide row ${glideRow.$rowID}`);
    }
    
    console.log(`DEBUG: Validated SKU ID:`, skuId);
    
    const orderLine = {
      id: glideRow.$rowID,           // Use Glide's $rowID as line ID
      sku_id: skuId,                 // Use validated SKU ID
      order_id: glideRow.DkAjz,      // DkAjz is order_id
      product_code: glideRow.PpduP,  // PpduP is product_code
      product_name: glideRow.Xoe7X,  // Xoe7X is product_name
      quantity: parseFloat(glideRow.xDa3g) || 0,  // xDa3g is quantity
      cost: parseFloat(glideRow.wlY2L) || 0,      // wlY2L is cost
      unit: glideRow.vszQ2,          // vszQ2 is unit
      created_at: glideRow['1OGzY']  // 1OGzY is created_at
    };

    console.log(`DEBUG: Mapped order line:`, JSON.stringify(orderLine, null, 2));
    return orderLine;
  }
} 