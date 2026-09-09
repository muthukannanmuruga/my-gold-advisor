CREATE TABLE public.silver_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_grams numeric NOT NULL,
  purchase_date date NOT NULL,
  purchase_price_per_gram numeric NOT NULL,
  purity numeric NOT NULL DEFAULT 99.9,
  total_amount numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_purchases TO authenticated;
GRANT ALL ON public.silver_purchases TO service_role;
ALTER TABLE public.silver_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own silver purchases" ON public.silver_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own silver purchases" ON public.silver_purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own silver purchases" ON public.silver_purchases FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own silver purchases" ON public.silver_purchases FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_silver_purchases_updated_at BEFORE UPDATE ON public.silver_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.silver_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_inr_per_gram numeric NOT NULL,
  source text DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.silver_price_history TO anon;
GRANT SELECT, INSERT ON public.silver_price_history TO authenticated;
GRANT ALL ON public.silver_price_history TO service_role;
ALTER TABLE public.silver_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Silver prices are publicly viewable" ON public.silver_price_history FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert silver prices" ON public.silver_price_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.silver_portfolio_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  investment numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  total_weight_grams numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_portfolio_metrics TO authenticated;
GRANT ALL ON public.silver_portfolio_metrics TO service_role;
ALTER TABLE public.silver_portfolio_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own silver metrics" ON public.silver_portfolio_metrics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own silver metrics" ON public.silver_portfolio_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own silver metrics" ON public.silver_portfolio_metrics FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own silver metrics" ON public.silver_portfolio_metrics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_silver_portfolio_metrics_updated_at BEFORE UPDATE ON public.silver_portfolio_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_yesterday_last_silver_price()
RETURNS TABLE(price_inr_per_gram numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_date_ist date;
  yesterday_ist date;
  yesterday_start_utc timestamptz;
  yesterday_end_utc timestamptz;
BEGIN
  current_date_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  yesterday_ist := current_date_ist - INTERVAL '1 day';
  yesterday_start_utc := (yesterday_ist - INTERVAL '1 day')::timestamptz + INTERVAL '18 hours 30 minutes';
  yesterday_end_utc := yesterday_ist::timestamptz + INTERVAL '18 hours 29 minutes 59.999999 seconds';

  RETURN QUERY
  SELECT sph.price_inr_per_gram
  FROM silver_price_history sph
  WHERE sph.created_at >= yesterday_start_utc
    AND sph.created_at <= yesterday_end_utc
  ORDER BY sph.created_at DESC
  LIMIT 1;
END;
$function$;