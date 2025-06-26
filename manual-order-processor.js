import 'dotenv/config';
import db from './db.js';
import { dataSourceFactory } from './data-sources/adapter-factory.js';
import { v4 as uuidv4 } from 'uuid';

async function processOrderById(orderId) {
    if (!orderId) {
        console.error('Error: No order ID provided. Please pass an order ID as an argument.');
        console.log('Usage: node manual-order-processor.js <order-id>');
        return;
    }

    console.log(`Manually starting to process order: ${orderId}`);

    // Get Glide adapter
    const glideAdapter = await dataSourceFactory.getAdapter('glide');

    try {
        // Fetch full order from Glide
        const order = await glideAdapter.fetchOrderById(orderId);
        if (!order || !order.items || order.items.length === 0) {
            console.warn(`Order ${orderId} not found in Glide or has no items, skipping.`);
            return;
        }

        // Debug: print the full first item to inspect all fields
        if (order.items.length > 0) {
            console.log('Full first order line item:', order.items[0]);
        }

        // The supplier_id is on the line items, not the order itself.
        // Extract it from the first item before creating the order.
        const supplierId = order.items.length > 0 ? order.items[0].supplierId : null;
        if (!supplierId) {
            console.error(`Could not determine supplier for order ${orderId}, skipping.`);
            return;
        }
        
        // Try to fetch the existing order to get the original order_date
        let orderDate = order.items[0].createdAt;
        const existingOrder = await db.getOrderById(order.id);
        if (existingOrder && existingOrder.order_date) {
            orderDate = existingOrder.order_date;
        }

        await db.createOrder({
            id: order.id,
            external_id: order.id,
            source: 'glide',
            supplier_id: supplierId,
            supplier_name: order.items[0].supplierName,
            order_date: orderDate,
            timestamp: order.items[0].createdAt,
            status: 'processed'
        });

        // Use a Set to avoid duplicate line insertions
        const insertedLineIds = new Set();

        // Insert order lines with all snapshot fields
        for (const item of order.items) {
            const lineId = `${order.id}-${item.product_code}`; // Use product_code for uniqueness
            if (insertedLineIds.has(lineId)) {
                continue; // Skip if already inserted
            }
            
            await db.createOrderLine({
                id: lineId,
                order_id: order.id,
                product_code: item.product_code,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.cost,
                unit: item.unit,
                location_id: item.location_id
            });
            insertedLineIds.add(lineId);
        }

        console.log(`✅ Successfully processed and saved order ${orderId}`);

    } catch (error) {
        console.error(`Failed to process order ${orderId}:`, error);
        db.monitoring.logOperation('manual_order_processing', 'failed', `Order ID: ${orderId}, Error: ${error.message}`);
    }
}

const orderId = process.argv[2];
processOrderById(orderId).then(() => process.exit(0)); 