import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFDValueOnDate, getISTDateString, type FixedDeposit } from "@/lib/fixedDeposit";
import { useSession } from "@/hooks/useSession";

interface Props { refreshTrigger: number; onMetricsUpdated: () => void }

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const FDPortfolioMetricsUpdater = ({ refreshTrigger, onMetricsUpdated }: Props) => {
  const { session } = useSession();

  useEffect(() => {
    const rebuild = async () => {
      const userId = session?.user?.id;
      if (!userId) return;
      const { data, error } = await supabase.from("fixed_deposits").select("*").order("start_date");
      if (error) return;
      await supabase.from("fd_portfolio_metrics").delete().eq("user_id", userId);
      const deposits = (data ?? []).filter((fd) => !fd.closed_at);
      if (!deposits.length) { onMetricsUpdated(); return; }

      const firstDate = deposits.reduce((earliest, fd) => fd.start_date < earliest ? fd.start_date : earliest, deposits[0].start_date);
      const today = getISTDateString();
      const metrics = [];
      for (let date = firstDate; date <= today; date = addDays(date, 1)) {
        const included = deposits.filter((fd) => fd.start_date <= date);
        metrics.push({
          user_id: userId,
          date,
          investment: included.reduce((sum, fd) => sum + Number(fd.principal), 0),
          current_value: included.reduce((sum, fd) => sum + getFDValueOnDate(fd as FixedDeposit, date), 0),
          fd_count: included.length,
        });
      }
      for (let index = 0; index < metrics.length; index += 500) {
        const { error: upsertError } = await supabase.from("fd_portfolio_metrics").upsert(metrics.slice(index, index + 500), { onConflict: "user_id,date" });
        if (upsertError) { console.error("Error rebuilding FD history", upsertError); return; }
      }
      onMetricsUpdated();
    };
    rebuild();
  }, [refreshTrigger, session?.user?.id, onMetricsUpdated]);

  return null;
};
