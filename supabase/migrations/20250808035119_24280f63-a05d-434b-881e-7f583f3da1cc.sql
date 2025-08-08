-- Create RPC function to get yesterday's last gold price in IST timezone
CREATE OR REPLACE FUNCTION get_yesterday_last_price()
RETURNS TABLE(price_inr_per_gram numeric) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT gph.price_inr_per_gram
  FROM gold_price_history gph
  WHERE gph.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' >= 
        (CURRENT_DATE - INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC'
    AND gph.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' < 
        CURRENT_DATE AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC'
  ORDER BY gph.created_at DESC
  LIMIT 1;
END;
$$;