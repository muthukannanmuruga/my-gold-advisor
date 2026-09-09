import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

interface Props {
  refreshTrigger: number;
  onMetricsUpdated?: () => void;
}

const MARKUP = 1.25; // 15% import duty + 10% local charges

export const SilverPortfolioMetricsUpdater = ({ refreshTrigger, onMetricsUpdated }: Props) => {
  const { session } = useSession();

  const updateMetrics = async () => {
    if (!session?.user?.id) return;

    try {
      await supabase.from("silver_portfolio_metrics").delete().eq("user_id", session.user.id);

      const { data: purchases, error: purchasesError } = await supabase
        .from("silver_purchases")
        .select("*")
        .eq("user_id", session.user.id)
        .order("purchase_date", { ascending: true });
      if (purchasesError) return;
      if (!purchases?.length) return onMetricsUpdated?.();

      const { data: priceHistory, error: priceError } = await supabase
        .from("silver_price_history")
        .select("*")
        .order("created_at", { ascending: true });
      if (priceError || !priceHistory?.length) return;

      const metricsMap = new Map<string, any>();

      purchases.forEach((purchase: any) => {
        const startDate = new Date(purchase.purchase_date);
        const endDate = new Date();
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toISOString().split("T")[0];
          if (!metricsMap.has(dateKey)) {
            metricsMap.set(dateKey, {
              date: dateKey,
              investment: 0,
              totalWeight: 0,
              purchases: [],
            });
          }
          const metrics = metricsMap.get(dateKey);
          metrics.investment += Number(purchase.total_amount);
          metrics.totalWeight += Number(purchase.weight_grams);
          metrics.purchases.push(purchase);
        }
      });

      const rows = Array.from(metricsMap.entries()).map(([date, metrics]) => {
        const dayPrices = priceHistory.filter(
          (p: any) => String(p.created_at).split("T")[0] <= date
        );
        const latestPrice = dayPrices.length > 0 ? dayPrices[dayPrices.length - 1] : null;
        let currentValue = 0;

        if (latestPrice) {
          const basePrice = Number((latestPrice as any).price_inr_per_gram);
          metrics.purchases.forEach((purchase: any) => {
            const purity = Number(purchase.purity) || 100;
            const weight = Number(purchase.weight_grams);
            currentValue += weight * basePrice * MARKUP * (purity / 100);
          });
        }

        return {
          user_id: session.user.id,
          date,
          investment: metrics.investment,
          current_value: currentValue,
          total_weight_grams: metrics.totalWeight,
        };
      });

      await supabase.from("silver_portfolio_metrics").upsert(rows, {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      });

      onMetricsUpdated?.();
    } catch (err) {
      console.error("Error updating silver metrics", err);
    }
  };

  useEffect(() => {
    updateMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, session?.user?.id]);

  return null;
};
