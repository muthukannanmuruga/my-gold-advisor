-- Create a table to store historical gold prices
CREATE TABLE public.gold_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_inr_per_gram NUMERIC NOT NULL,
  price_usd_per_ounce NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'api'
);

-- Enable Row Level Security
ALTER TABLE public.gold_price_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (everyone can see gold prices)
CREATE POLICY "Gold prices are publicly viewable" 
ON public.gold_price_history 
FOR SELECT 
USING (true);

-- Create policy for insert (only authenticated users can add prices)
CREATE POLICY "Authenticated users can insert gold prices" 
ON public.gold_price_history 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX idx_gold_price_history_created_at ON public.gold_price_history(created_at DESC);