-- Fix the get_yesterday_last_price function to properly handle IST timezone
-- The issue is that we need to convert the current date to IST properly

DROP FUNCTION IF EXISTS public.get_yesterday_last_price();

CREATE OR REPLACE FUNCTION public.get_yesterday_last_price()
 RETURNS TABLE(price_inr_per_gram numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  yesterday_start_utc timestamptz;
  yesterday_end_utc timestamptz;
  current_date_ist date;
  yesterday_ist date;
BEGIN
  -- Get current date in IST
  current_date_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  
  -- Get yesterday's date in IST
  yesterday_ist := current_date_ist - INTERVAL '1 day';
  
  -- Convert yesterday's IST date range to UTC timestamps
  yesterday_start_utc := (yesterday_ist::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Kolkata';
  yesterday_end_utc := (yesterday_ist::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'Asia/Kolkata';
  
  RETURN QUERY
  SELECT gph.price_inr_per_gram
  FROM gold_price_history gph
  WHERE gph.created_at >= yesterday_start_utc 
    AND gph.created_at <= yesterday_end_utc
  ORDER BY gph.created_at DESC
  LIMIT 1;
END;
$function$