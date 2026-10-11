# Carpet DM website

Static site in `public/` plus two small server functions for the shop's Grow payments.
Built by `site-full/build_site.py` in the project files; do not edit `public/` by hand.

## Netlify setup (once)
1. Netlify > Add new site > Import from GitHub > this repository. Build command: none. Publish directory: `public` (already in `netlify.toml`).
2. Site configuration > Environment variables:
   - `GROW_USER_ID`, `GROW_PAGE_CODE` (from Grow; sandbox values first)
   - `GROW_ENV` = `production` only after Grow approves the live review (anything else = sandbox)
3. Forms > Form notifications > Email: send `orders`, `declaration-60`, `declaration-40` and `newsletter` to the studio's address.
4. Domain: add `www.carpet-dm.com` and `carpet-dm.com`, then switch DNS (see the go-live guide).

## How the shop pays
Browser cart -> `POST /api/checkout` (prices come from `netlify/functions/_shop.mjs`, never from the browser)
-> order saved to the `orders` form (status "ממתין לתשלום") -> Grow `createPaymentProcess` -> Grow page in a sheet
-> Grow calls `/api/grow-notify` -> `approveTransaction` -> order saved again as "שולם ✓".
Shipping by courier is switched off until the studio gives a price (`DELIVERY.courier.price` in `_shop.mjs` and `public/assets/shop.js`).
