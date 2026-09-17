# Refine Fixed Deposit tracking

## What will change

- Format all FD rupee amounts with Indian digit grouping, including amount fields while typing, previews, summary tiles, records, chart axes, and tooltips.
- Display automatic tenure without unnecessary trailing zeroes: `12`, `12.2`, or `12.23`.
- Show date-driven status indicators: **Active** in green, **Maturing soon** in orange when maturity is within the next 30 IST calendar days, and **Matured** in red.
- Remove the Close FD action. Records will remain relevant until maturity and can be edited or deleted; legacy closed records remain excluded from portfolio totals.

## Interest calculation

- Simple-interest current value will credit only completed monthly periods, with no partial-month accrual.
- The maturity amount will continue to use the complete agreed tenure, so the sample ₹1,50,000 deposit at 10% remains ₹1,65,000 at maturity.
- Compound deposits will continue to credit only completed periods according to Monthly, Quarterly, or At maturity frequency.
- Interest stops at the maturity date.

## Refresh and verification

- Rebuild FD history after additions, edits, and deletions so summaries and the graph use the same completed-period calculations.
- Verify the supplied 11-Oct-2025 to 11-Oct-2026 example shows ₹13,750 accrued and ₹1,63,750 current value on 17-Sep-2026.
- Check the FD tab at desktop and mobile widths where authentication permits.
