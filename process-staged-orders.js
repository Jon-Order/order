import 'dotenv/config';
import { getUnprocessedWebhookEvents, markWebhookEventProcessed, createOrder, createOrderLine } from './db.js';
import { dataSourceFactory } from './data-sources/adapter-factory.js';
import { v4 as uuidv4 } from 'uuid';

const BATCH_SIZE = process.env.ANALYTICS_BATCH_SIZE || 100;

export async function processStagedOrders() {
    // Get all unprocessed webhook events
    const events = await getUnprocessedWebhookEvents();
    if (!events.length) {
        console.log('No unprocessed webhook events found.');
        return;
    }
    // Get Glide adapter
    const glideAdapter = await dataSourceFactory.getAdapter('glide');

    for (const event of events) {
        try {
            const payload = JSON.parse(event.payload);
            const orderId = payload.order_id;
            const orderLineRowIds = payload.order_lines;

            if (!orderLineRowIds || orderLineRowIds.length === 0) {
                console.log(`Skipping event ${event.id} for order ${orderId}: No order line row IDs provided.`);
                await markWebhookEventProcessed(event.id);
                continue;
            }

            console.log(`Processing event ${event.id} for order ${orderId} with ${orderLineRowIds.length} line(s).`);

            // 1. Fetch order data from Glide orders table
            const glideOrder = await glideAdapter.fetchOrderFromGlide(orderId);
            if (!glideOrder) {
                console.log(`Order ${orderId} not found in Glide orders table. Skipping.`);
                await markWebhookEventProcessed(event.id);
                continue;
            }

            console.log('DEBUG: Glide order data:', JSON.stringify(glideOrder, null, 2));

            // 2. Fetch specific order lines from Big Order Lines table using row IDs from webhook
            const orderLines = await Promise.all(
                orderLineRowIds.map(rowId => glideAdapter.fetchOrderLineByRowId(rowId))
            );

            // Filter out any null results (in case some fetches failed)
            const validOrderLines = orderLines.filter(line => line !== null);
            if (validOrderLines.length === 0) {
                console.log(`No valid order lines found in Big Order Lines table for order ${orderId}. Skipping.`);
                await markWebhookEventProcessed(event.id);
                continue;
            }

            console.log('DEBUG: Valid order lines:', JSON.stringify(validOrderLines, null, 2));

            // 3. Create the order with data from Glide orders table
            await createOrder(glideOrder);

            // 4. Create order lines from Big Order Lines table
            for (const line of validOrderLines) {
                console.log('DEBUG: Raw line data:', JSON.stringify(line, null, 2));
                
                // Validate SKU ID
                if (!line.sku_id) {
                    console.error(`ERROR: Missing SKU ID for line ${line.id}, skipping`);
                    continue;
                }
                
                const orderLineData = {
                    id: line.id,  // Use the mapped ID
                    order_id: glideOrder.id,  // Use the order ID from the mapped order
                    sku_id: line.sku_id,  // Use the mapped sku_id field
                    product_code: line.product_code,  // Use mapped product_code
                    product_name: line.product_name,  // Use mapped product_name
                    quantity: line.quantity,  // Use mapped quantity
                    cost: line.cost,  // Use mapped cost
                    unit: line.unit,  // Use mapped unit
                    created_at: line.created_at  // Use mapped created_at
                };
                console.log('DEBUG: Mapped order line data:', JSON.stringify(orderLineData, null, 2));
                
                try {
                    await createOrderLine(orderLineData);
                    console.log(`Successfully created order line ${line.id} with SKU ID ${line.sku_id}`);
                } catch (error) {
                    console.error(`Failed to create order line ${line.id}:`, error);
                    throw error; // Re-throw to handle at the event level
                }
            }

            // Mark webhook event as processed
            await markWebhookEventProcessed(event.id);
            console.log(`Successfully processed order ${orderId}`);

        } catch (error) {
            console.error(`Error processing event ${event.id}:`, error);
            // Don't mark as processed if there was an error
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    processStagedOrders().catch(error => {
        console.error('Failed to run staged order processor:', error);
        process.exit(1);
    });
} 