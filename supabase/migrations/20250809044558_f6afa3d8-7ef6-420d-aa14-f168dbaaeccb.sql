-- Update the get_yesterday_last_price function with clearer IST boundary handling
-- IST is UTC+5:30, so midnight IST = 18:30 UTC previous day

DROP FUNCTION IF EXISTS public.get_yesterday_last_price();

CREATE OR REPLACE FUNCTION public.get_yesterday_last_price()
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
  -- Get current date in IST timezone
  current_date_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  
  -- Get yesterday's date in IST
  yesterday_ist := current_date_ist - INTERVAL '1 day';
  
  -- Calculate yesterday's date range in UTC
  -- IST midnight (00:00) = UTC 18:30 previous day
  -- IST 23:59:59 = UTC 18:29:59 same day
  yesterday_start_utc := (yesterday_ist - INTERVAL '1 day')::timestamptz + INTERVAL '18 hours 30 minutes';
  yesterday_end_utc := yesterday_ist::timestamptz + INTERVAL '18 hours 29 minutes 59.999999 seconds';
  
  RETURN QUERY
  SELECT gph.price_inr_per_gram
  FROM gold_price_history gph
  WHERE gph.created_at >= yesterday_start_utc 
    AND gph.created_at <= yesterday_end_utc
  ORDER BY gph.created_at DESC
  LIMIT 1;
END;
$function$