-- Add 22K gold price column to gold_price_history table
ALTER TABLE public.gold_price_history 
ADD COLUMN price_inr_per_gram_22k NUMERIC;

-- Update existing records to calculate 22K price from 24K price
UPDATE public.gold_price_history 
SET price_inr_per_gram_22k = price_inr_per_gram * (22.0 / 24.0)
WHERE price_inr_per_gram_22k IS NULL;

-- Update the existing manual entries with the correct 22K prices
UPDATE public.gold_price_history 
SET price_inr_per_gram_22k = 7940
WHERE created_at::date = '2025-03-01' AND source = 'manual';

UPDATE public.gold_price_history 
SET price_inr_per_gram_22k = 9155
WHERE created_at::date = '2025-07-14' AND source = 'manual';