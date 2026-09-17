CREATE TABLE public.fixed_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fd_id text NOT NULL,
  bank text NOT NULL,
  principal numeric NOT NULL,
  start_date date NOT NULL,
  maturity_date date NOT NULL,
  interest_rate numeric NOT NULL,
  interest_type text NOT NULL,
  payout_frequency text NOT NULL,
  tenure_months numeric NOT NULL,
  maturity_amount numeric NOT NULL,
  closed_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixed_deposits_user_fd_id_key UNIQUE (user_id, fd_id),
  CONSTRAINT fixed_deposits_fd_id_not_blank CHECK (length(btrim(fd_id)) > 0),
  CONSTRAINT fixed_deposits_bank_not_blank CHECK (length(btrim(bank)) > 0),
  CONSTRAINT fixed_deposits_principal_positive CHECK (principal > 0),
  CONSTRAINT fixed_deposits_rate_positive CHECK (interest_rate > 0),
  CONSTRAINT fixed_deposits_dates_valid CHECK (maturity_date > start_date),
  CONSTRAINT fixed_deposits_interest_type_valid CHECK (interest_type IN ('simple', 'compound')),
  CONSTRAINT fixed_deposits_payout_frequency_valid CHECK (payout_frequency IN ('monthly', 'quarterly', 'at_maturity')),
  CONSTRAINT fixed_deposits_tenure_positive CHECK (tenure_months > 0),
  CONSTRAINT fixed_deposits_maturity_amount_valid CHECK (maturity_amount >= principal),
  CONSTRAINT fixed_deposits_closed_at_valid CHECK (closed_at IS NULL OR closed_at >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_deposits TO authenticated;
GRANT ALL ON public.fixed_deposits TO service_role;
ALTER TABLE public.fixed_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own fixed deposits" ON public.fixed_deposits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fixed deposits" ON public.fixed_deposits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fixed deposits" ON public.fixed_deposits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fixed deposits" ON public.fixed_deposits FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_fixed_deposits_updated_at BEFORE UPDATE ON public.fixed_deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fd_portfolio_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  investment numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  fd_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fd_portfolio_metrics_user_date_key UNIQUE (user_id, date),
  CONSTRAINT fd_portfolio_metrics_investment_nonnegative CHECK (investment >= 0),
  CONSTRAINT fd_portfolio_metrics_value_nonnegative CHECK (current_value >= 0),
  CONSTRAINT fd_portfolio_metrics_count_nonnegative CHECK (fd_count >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fd_portfolio_metrics TO authenticated;
GRANT ALL ON public.fd_portfolio_metrics TO service_role;
ALTER TABLE public.fd_portfolio_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own FD metrics" ON public.fd_portfolio_metrics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own FD metrics" ON public.fd_portfolio_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own FD metrics" ON public.fd_portfolio_metrics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own FD metrics" ON public.fd_portfolio_metrics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_fd_portfolio_metrics_updated_at BEFORE UPDATE ON public.fd_portfolio_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();