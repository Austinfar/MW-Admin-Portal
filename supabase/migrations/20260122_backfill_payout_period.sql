-- Backfill payout_period_start in commission_ledger based on transaction_date
-- Logic matches getPayoutPeriodStart in commissions.ts
-- Anchor date: Monday Dec 16, 2024
-- Period length: 14 days

WITH calculated_periods AS (
  SELECT
    id,
    transaction_date,
    -- Calculate days since anchor (date - date returns integer)
    (transaction_date::date - '2024-12-16'::date) AS diff_days,
    -- Calculate period index (floor division by 14)
    FLOOR((transaction_date::date - '2024-12-16'::date) / 14)::int AS period_index
  FROM
    public.commission_ledger
  WHERE
    transaction_date IS NOT NULL
)
UPDATE public.commission_ledger cl
SET
  payout_period_start = ('2024-12-16'::date + (cp.period_index * 14 * INTERVAL '1 day'))::text
FROM
  calculated_periods cp
WHERE
  cl.id = cp.id
  AND cl.transaction_date IS NOT NULL;
