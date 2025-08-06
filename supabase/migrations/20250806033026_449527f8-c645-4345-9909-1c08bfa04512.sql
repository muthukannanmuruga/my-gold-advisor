-- Create portfolio_metrics table to track investment portfolio over time
CREATE TABLE public.portfolio_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  investment NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  total_weight_grams NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.portfolio_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own portfolio metrics" 
ON public.portfolio_metrics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own portfolio metrics" 
ON public.portfolio_metrics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio metrics" 
ON public.portfolio_metrics 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio metrics" 
ON public.portfolio_metrics 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_portfolio_metrics_updated_at
BEFORE UPDATE ON public.portfolio_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert historical gold price data
INSERT INTO public.gold_price_history (price_inr_per_gram, created_at, source) VALUES 
(8662, '2025-03-01 14:00:00+05:30', 'manual'),
(9988, '2025-07-14 14:00:00+05:30', 'manual');

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily gold price fetch at 2 PM IST (8:30 AM UTC)
SELECT cron.schedule(
  'daily-gold-price-fetch',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ofhcjjajscwutppzinun.supabase.co/functions/v1/fetch-daily-gold-price',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maGNqamFqc2N3dXRwcHppbnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxOTA0MjMsImV4cCI6MjA2OTc2NjQyM30.qghpZLVHt_QAjhtgbtcZ3GB5YSbCebtXVLM_AmgnWyM"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);