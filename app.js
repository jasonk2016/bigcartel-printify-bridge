import express from 'express';
import fetch from 'node-fetch';
import cron from 'node-cron';

const app = express();
app.use(express.json());

// --- CONFIG ---
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const BIGCARTEL_TOKEN = process.env.BIGCARTEL_TOKEN;
const BIGCARTEL_STORE_ID = process.env.BIGCARTEL_STORE_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// --- IN-MEMORY SKU MAP ---
let SKU_MAP = {};

// --- BUILD SKU MAP ---
async function buildSkuMap() {
  try {
    console.log('Refreshing SKU → Printify map...');
    const res = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
      headers: { 'Authorization': `Bearer ${PRINTIFY_API_KEY}` }
    });
    const products = await res.json();

    let map = {};
    for (const product of products.data) {
      for (const variant of product.variants) {
        map[variant.sku] = {
          product_id: product.id,
          variant_id: variant.id
        };
      }
    }
    SKU_MAP = map;
    console.log(`Mapped ${Object.keys(SKU_MAP).length} SKUs from Printify`);
  } catch (err) {
    console.error('Error building SKU map:', err.message);
  }
}

// --- VERIFY WEBHOOK TOKEN ---
function verifyWebhook(req, res, next) {
  const token = req.query.token;
  if (!token || token !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized webhook call' });
  }
  next();
}

// --- ORDER WEBHOOK ---
app.post('/bigcartel-webhook', verifyWebhook, async (req, res) => {
  try {
    const order = req.body;
    if (!order?.items) {
      return res.status(400).json({ error: 'Invalid order payload' });
    }

    const lineItems = order.items.map(item => {
      const mapping = SKU_MAP[item.sku];
      if (!mapping) throw new Error(`SKU ${item.sku} not found in Printify`);
      return {
        product_id: mapping.product_id,
        variant_id: mapping.variant_id,
        quantity: item.quantity
      };
    });

    const payload = {
      external_id: `bigcartel-${order.id}`,
      label: "Big Cartel Order",
      line_items: lineItems,
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: {
        first_name: order.shipping_address.first_name,
        last_name: order.shipping_address.last_name,
        email: order.email || "customer@example.com",
        country: order.shipping_address.country,
        region: order.shipping_address.state,
        address1: order.shipping_address.address1,
        city: order.shipping_address.city,
        zip: order.shipping_address.zip
      }
    };

    const printifyRes = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await printifyRes.json();
    console.log('✅ Printify order created:', data);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ Order Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- INVENTORY SYNC ---
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log('Running inventory sync...');
    const printifyRes = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
      headers: { 'Authorization': `Bearer ${PRINTIFY_API_KEY}` }
    });
    const products = await printifyRes.json();

    for (const product of products.data) {
      for (const variant of product.variants) {
        const sku = variant.sku;
        const quantity = variant.is_enabled ? 999 : 0;
        await fetch(`https://api.bigcartel.com/stores/${BIGCARTEL_STORE_ID}/products/${sku}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${BIGCARTEL_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ quantity })
        });
        console.log(`Updated SKU ${sku} → quantity ${quantity}`);
      }
    }
    console.log('Inventory sync complete.');
  } catch (err) {
    console.error('Inventory Sync Error:', err.message);
  }
});

// --- DAILY SKU MAP REFRESH ---
cron.schedule('0 0 * * *', buildSkuMap); // Every midnight

// --- STARTUP ---
(async () => {
  await buildSkuMap();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
})();
