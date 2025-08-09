import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

interface Props {
  refreshTrigger: number;
  onMetricsUpdated?: () => void;
}

export const PortfolioMetricsUpdater = ({ refreshTrigger, onMetricsUpdated }: Props) => {
  const { session } = useSession();

  const updatePortfolioMetrics = async () => {
    if (!session?.user?.id) return;

    try {
      // Clear old metrics
      await supabase.from("portfolio_metrics").delete().eq("user_id", session.user.id);

      // Get all purchases for this user
      const { data: purchases, error: purchasesError } = await supabase
        .from("gold_purchases")
        .select("*")
        .eq("user_id", session.user.id)
        .order("purchase_date", { ascending: true });
      if (purchasesError) return;
      if (!purchases?.length) return onMetricsUpdated?.();

      // Get all price history
      const { data: priceHistory, error: priceError } = await supabase
        .from("gold_price_history")
        .select("*")
        .order("created_at", { ascending: true });
      if (priceError || !priceHistory?.length) return;

      const metricsMap = new Map();

      purchases.forEach((purchase) => {
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

      const portfolioMetrics = Array.from(metricsMap.entries()).map(([date, metrics]) => {
        const dayPrices = priceHistory.filter((p) => p.created_at.split("T")[0] <= date);
        const latestPrice = dayPrices.length > 0 ? dayPrices[dayPrices.length - 1] : null;
        let currentValue = 0;

        if (latestPrice) {
          const basePrice = Number(latestPrice.price_inr_per_gram);
          metrics.purchases.forEach((purchase) => {
            let carat = purchase.carat;
            if (typeof carat === "string") carat = parseInt(carat) || 24;
            const weight = Number(purchase.weight_grams);
            const purityFactor = carat / 24;
            const pricePerGram = basePrice * 1.075 * purityFactor;
            currentValue += weight * pricePerGram;
          });
        } else {
          currentValue = metrics.totalWeight * 7200;
        }

        return {
          user_id: session.user.id,
          date,
          investment: metrics.investment,
          current_value: currentValue,
          total_weight_grams: metrics.totalWeight,
        };
      });

      // ✅ Batch upsert in one call
      await supabase.from("portfolio_metrics").upsert(portfolioMetrics, {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      });

      onMetricsUpdated?.();
    } catch (err) {
      console.error("Error updating metrics", err);
    }
  };

  useEffect(() => {
    updatePortfolioMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, session?.user?.id]);

  return null;
};
