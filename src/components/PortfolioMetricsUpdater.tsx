import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

interface PortfolioMetricsUpdaterProps {
  refreshTrigger: number;
}

export const PortfolioMetricsUpdater = ({ refreshTrigger }: PortfolioMetricsUpdaterProps) => {
  const { session } = useSession();

  const updatePortfolioMetrics = async () => {
    if (!session?.user?.id) return;

    try {
      // Get all user purchases
      const { data: purchases, error: purchasesError } = await supabase
        .from("gold_purchases")
        .select("*")
        .eq("user_id", session.user.id)
        .order("purchase_date", { ascending: true });

      if (purchasesError || !purchases?.length) return;

      // Get gold price history
      const { data: priceHistory, error: priceError } = await supabase
        .from("gold_price_history")
        .select("*")
        .order("created_at", { ascending: true });

      if (priceError || !priceHistory?.length) return;

      // Calculate portfolio metrics for each day
      const metricsMap = new Map();

      purchases.forEach(purchase => {
        const purchaseDate = purchase.purchase_date;
        
        // Find all days from purchase date to today
        const startDate = new Date(purchaseDate);
        const endDate = new Date();
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toISOString().split('T')[0];
          
          if (!metricsMap.has(dateKey)) {
            metricsMap.set(dateKey, {
              date: dateKey,
              investment: 0,
              totalWeight: 0,
              purchases: []
            });
          }
          
          const metrics = metricsMap.get(dateKey);
          metrics.investment += Number(purchase.total_amount);
          metrics.totalWeight += Number(purchase.weight_grams);
          metrics.purchases.push(purchase);
        }
      });

      // Calculate current value for each day using historical gold prices
      const portfolioMetrics = Array.from(metricsMap.entries()).map(([date, metrics]) => {
        // Find the closest gold price for this date
        const dayPrices = priceHistory.filter(p => 
          p.created_at.split('T')[0] <= date
        );
        
        const closestPrice = dayPrices.length > 0 
          ? dayPrices[dayPrices.length - 1].price_inr_per_gram 
          : 7200; // fallback price

        const currentValue = metrics.totalWeight * closestPrice;

        return {
          user_id: session.user.id,
          date,
          investment: metrics.investment,
          current_value: currentValue,
          total_weight_grams: metrics.totalWeight
        };
      });

      // Upsert portfolio metrics
      for (const metric of portfolioMetrics) {
        await supabase
          .from("portfolio_metrics")
          .upsert(metric, { 
            onConflict: "user_id,date",
            ignoreDuplicates: false 
          });
      }

    } catch (error) {
      console.error("Error updating portfolio metrics:", error);
    }
  };

  useEffect(() => {
    updatePortfolioMetrics();
  }, [refreshTrigger, session?.user?.id]);

  return null; // This is a background component
};