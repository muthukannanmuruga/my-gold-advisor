# Add a Fixed Deposit tracker tab

## What the user gets

- Add a third **Fixed Deposit** tab beside Gold and Silver; Gold remains selected by default.
- Show four FD summary cards:
  - **Total Investment** — principal across active and matured FDs; closed FDs remain recorded but are excluded.
  - **Current Value** — principal plus accrued interest for active FDs, capped at maturity value for matured FDs.
  - **Total Returns** — current value minus total investment.
  - **Count** — active and matured FD count, with a small status breakdown.
- Add a portfolio graph plotting total invested principal and total FD value over time.
- Add an FD entry form and a records list with edit, close, and delete actions.

## FD entry and records

The form will capture:

- FD ID — required and unique per user.
- Bank — required.
- Principal — positive INR amount.
- Start Date and Maturity Date — maturity must be after start.
- Interest Rate — positive annual percentage, allowing decimals.
- Interest Type — Simple or Compound.
- Payout Frequency — Monthly, Quarterly, or At maturity.
- Tenure — read-only, automatically calculated in months to two decimals.
- Maturity Amount — read-only, automatically calculated from the selected interest rules.
- Status — Active and Matured are date-driven; Closed is a manual action.

The FD list will display all entered details, current value, accrued returns, and a clear Active/Matured/Closed badge. Editing any financial or date field recalculates the values; closing an FD records the closure date and stops future interest.

## Calculation rules

- Values are recalculated using IST dates.
- **Simple interest:** `principal × annual rate × elapsed time in years`, capped at the maturity date.
- **Compound interest:** payout frequency sets the compounding interval:
  - Monthly: 12 periods per year.
  - Quarterly: 4 periods per year.
  - At maturity: 1 period per year.
- Current value grows only through completed compounding periods and never beyond the maturity date.
- Maturity amount uses the full start-to-maturity tenure.
- The payout frequency is a calculation choice but does not subtract paid interest from portfolio totals, as requested.
- Closed FDs stop accruing on their recorded closure date and remain visible in the records list.

## Graph behavior

- Plot one daily point from the earliest FD start date through today.
- For each day, include only FDs that had started by that date.
- Cap each FD’s interest at its maturity or closure date.
- Rebuild the complete graph whenever an FD is added, edited, closed, or deleted so stale values cannot remain.
- Include independent 1 Week, 1 Month, 3 Months, and 1 Year range selection consistent with the existing portfolio charts.

## Data and access

Create separate FD data without changing Gold or Silver records:

- `fixed_deposits` for FD details, derived maturity amount, manual closure date, and timestamps.
- `fd_portfolio_metrics` for daily investment and value history.
- Add explicit authenticated/service grants, row-level security, per-user create/read/update/delete policies, date/rate checks, and a per-user unique FD ID.

## Technical implementation

- Add shared FD calculation and IST date helpers so the form preview, summary, list, and graph use exactly the same formulas.
- Add focused components for the FD summary, graph, entry/edit form, records list, and full-history metrics updater.
- Wire independent FD refresh state into the existing tab page so every mutation refreshes summaries, records, and the graph automatically.
- Extend generated Supabase types for the two new tables.
- Validate the database policies and calculations, then verify add, edit, close, delete, maturity capping, tab switching, graph refresh, and mobile/desktop layouts.
