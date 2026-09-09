# Add a Silver tab alongside Gold

## About the dollar-to-rupee rate

For gold the app never converts currencies — it calls GoldAPI's INR endpoint (`XAU/INR`), which already returns rupee prices. The same works for silver: `XAG/INR`. So silver will use `https://www.goldapi.io/api/XAG/INR` with the same rotating set of API keys, and no separate exchange-rate service is needed. Import duty (15%) and local charges (5%) are then added on top, exactly as gold adds 6% + 1.5%.

If GoldAPI ever rejects the INR silver endpoint, the fallback is to call `XAG/USD` and derive the rupee rate from the gold call (gold INR price divided by gold USD price), still with no third-party service.

## What the user sees

- The landing page gets two tabs at the top: **Gold** (selected by default) and **Silver**.
- Gold tab: everything exactly as today, unchanged.
- Silver tab: the same layout — live silver price card, summary cards, two charts (silver price over time, silver portfolio value over time), add-purchase form, and purchase list.
- In the silver purchase form, "Carat" is replaced by a **Purity** text box accepting decimals (e.g. 99.999, 80, 80.99), validated between 0 and 100.
- Silver current value is scaled by purity: weight x rate x purity/100.

## Data

New tables kept fully separate from gold (gold data untouched):

- `silver_purchases` — user_id, weight_grams, purchase_date, purchase_price_per_gram, purity (numeric, 0-100), total_amount, description, timestamps.
- `silver_price_history` — price_inr_per_gram, source, created_at.
- `silver_portfolio_metrics` — user_id, date, investment, current_value, total_weight_grams.

Each table gets GRANTs, row-level security, and per-user policies mirroring the gold tables (price history publicly readable, insert for signed-in users).

## Technical notes

- New components mirroring the gold ones: `SilverPriceWidget`, `SilverCharts` (or a shared, metal-parameterised chart), `SilverPortfolioSummary`, `AddSilverPurchaseForm`, `SilverPurchasesList`, `SilverPortfolioMetricsUpdater`.
- `src/pages/Index.tsx` wraps the existing gold block and the new silver block in shadcn `Tabs`, default value `gold`.
- Silver price maths: `base = XAG INR per gram`; `total = base * (1 + 0.15 + 0.05)`. Breakdown card shows base, import duty (15%), local charges (20% total line) like gold does.
- Day-over-day change reuses the same IST-boundary approach; add a `get_yesterday_last_silver_price()` security-definer function mirroring `get_yesterday_last_price()`.
- The existing daily 2 PM IST job (`fetch-daily-gold-price`) is extended to also fetch and store the silver price in `silver_price_history`.
- No fallback prices are written to the database, matching the gold rule.
