import fs from 'fs';
import { parse } from 'csv-parse';
import 'dotenv/config';
import { query, get, run, createOrder, createOrderLine } from './db.js';

async function importOrders() {
    const orderStream = fs.createReadStream('data/Orders.csv');
    const orderParser = orderStream.pipe(parse({ columns: true, skip_empty_lines: true }));

    for await (const row of orderParser) {
        try {
            await createOrder({
                id: row['🔒 Order Row ID'],
                order_date: row['Order Info/Order Date'],
                status: row['Status/System Status'],
                created_at: row['Order History/Created'],
                updated_at: row['Order History/Created'],
                supplier_id: row['Supplier Info/Supplier ID'],
                location_id: row['Order History/Ordered by Location ID'],
                created_by: row['Order History/User ID']
            });
            console.log(`Imported order: ${row['🔒 Order Row ID']}`);
        } catch (error) {
            console.error(`Error importing order ${row['🔒 Order Row ID']}:`, error);
        }
    }
}

async function importOrderLines() {
    const lineStream = fs.createReadStream('data/ddd521.Big Order Lines.csv');
    const lineParser = lineStream.pipe(parse({ columns: true, skip_empty_lines: true }));

    for await (const row of lineParser) {
        try {
            await createOrderLine({
                id: row['🔒 Row ID'],
                order_id: row['Order Info/Order ID'],
                sku_id: row['SKU Row ID'],
                quantity: parseFloat(row['Quantity']) || 0,
                cost: parseFloat(row['Cost']) || 0,
                supplier_id: row['Supplier ID'],
                location_id: row['Location ID'],
                product_code: row['Product Code'],
                product_name: row['Product Name'],
                unit: row['Unit'],
                created_at: row['Created'],
                updated_at: row['Created'],
                notes: null
            });
            console.log(`Imported order line: ${row['🔒 Row ID']}`);
        } catch (error) {
            console.error(`Error importing order line ${row['🔒 Row ID']}:`, error);
        }
    }
}

console.log('Starting import...');
await importOrders();
console.log('Orders imported, now importing order lines...');
await importOrderLines();
console.log('Import complete!'); 