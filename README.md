# Big Cartel → Printify Automation Bridge

This project automatically connects your Big Cartel store to Printify using webhooks and APIs.  
It does two main things:
1. **Order Sync** – Whenever an order is placed in Big Cartel, it is automatically sent to Printify for fulfillment.
2. **Inventory Sync** – Every 30 minutes, product availability from Printify is synced back to Big Cartel.

## 🚀 Deploy to Your Hosting
You can deploy this project for free to Railway or Render using the buttons below.

### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?repo=https://github.com/Jasonk2016/bigcartel-printify-bridge)

### Render
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Jasonk2016/bigcartel-printify-bridge)

## ⚙️ Setup Steps
1. Deploy with one of the buttons above.
2. Add your environment variables in the hosting dashboard (see `.env.example`).
3. In Big Cartel → Settings → Webhooks, add:
