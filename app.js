import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// --- CONFIG ---
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

// --- ROUTES ---
// Health check
app.get('/', (req, res) => {
  res.send('BigCartel → Printify bridge is live!');
});

// Endpoint for Pipedream to send parsed order data
app.post('/order', async (req, res) => {
  try {
    const orderData = req.body;

    console.log("Received order from Pipedream:", orderData);

    // Transform incoming data to Printify API format
    const printifyOrder = {
      external_id: orderData.order_id,
      label: orderData.customer_name,
      line_items: orderData.items.map(item => ({
        product_id: item.printify_product_id,
        variant_id: item.printify_variant_id,
        quantity: item.quantity
      })),
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: {
        first_name: orderData.first_name,
        last_name: orderData.last_name,
        email: orderData.email,
        phone: orderData.phone || "",
        country: orderData.country,
        region: orderData.state || "",
        address1: orderData.address1,
        address2: orderData.address2 || "",
        city: orderData.city,
        zip: orderData.zip
      }
    };

    // Send order to Printify
    const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printifyOrder)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Printify API error:", result);
      return res.status(400).json({ error: result });
    }

    console.log("Order successfully sent to Printify:", result);
    res.json({ success: true, printify_order: result });

  } catch (err) {
    console.error("Error processing order:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
