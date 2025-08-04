import { useEffect, useState, useRef, useCallback, memo } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Weight } from "lucide-react";

interface PortfolioStats {
  totalWeight: number;
  totalInvestment: number;
  currentValue: number;
  totalGain: number;
  gainPercentage: number;
  averagePurchasePrice: number;
  averagePurePurchasePrice: number;
}

interface PortfolioSummaryProps {
  refreshTrigger: number;
  currentGoldPrice: number; // 24K price
}

const PortfolioSummary = memo(({
  refreshTrigger,
  currentGoldPrice,
}: PortfolioSummaryProps) => {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [delayedLoading, setDelayedLoading] = useState(true);
  const calculationLock = useRef(false);
  const prevStats = useRef<PortfolioStats | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const persisted = localStorage.getItem("portfolioStats");
    if (persisted) {
      try {
        prevStats.current = JSON.parse(persisted);
        setStats(prevStats.current);
      } catch {
        prevStats.current = null;
        setStats(null);
      }
      setIsLoading(false);
    }
  }, []);

  const calculateStats = useCallback(async (price24K: number) => {
    if (price24K <= 0 || calculationLock.current) return;

    calculationLock.current = true;
    setIsLoading(true);
    setDelayedLoading(true);

    try {
      const { data: purchases, error } = await supabase
        .from("gold_purchases")
        .select("*");

      if (error) throw error;

      let newStats: PortfolioStats;
      if (!purchases?.length) {
        newStats = {
          totalWeight: 0,
          totalInvestment: 0,
          currentValue: 0,
          totalGain: 0,
          gainPercentage: 0,
          averagePurchasePrice: 0,
          averagePurePurchasePrice: 0,
        };
      } else {
        const totalWeight = purchases.reduce((sum, p) => sum + (p.weight_grams || 0), 0);
        const totalInvestment = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

        const pureGoldWeight = purchases.reduce((sum, p) => {
          const purityFactor = (p.carat ?? 24) / 24;
          return sum + (p.weight_grams || 0) * purityFactor;
        }, 0);

        const currentValue = purchases.reduce((sum, p) => {
          const purityFactor = (p.carat ?? 24) / 24;
          return sum + (p.weight_grams || 0) * price24K * purityFactor;
        }, 0);

        const totalGain = currentValue - totalInvestment;

        newStats = {
          totalWeight,
          totalInvestment,
          currentValue,
          totalGain,
          gainPercentage: totalInvestment > 0 ? (totalGain / totalInvestment) * 100 : 0,
          averagePurchasePrice: totalWeight > 0 ? totalInvestment / totalWeight : 0,
          averagePurePurchasePrice: pureGoldWeight > 0 ? totalInvestment / pureGoldWeight : 0,
        };
      }

      flushSync(() => {
        setStats(newStats);
        setIsLoading(false);
      });

      prevStats.current = newStats;
      localStorage.setItem("portfolioStats", JSON.stringify(newStats));

      timeoutRef.current = setTimeout(() => {
        setDelayedLoading(false);
      }, 2000);
    } catch (err) {
      console.error("Error calculating stats:", err);
      setIsLoading(false);
      setDelayedLoading(false);
    } finally {
      calculationLock.current = false;
    }
  }, []);

  useEffect(() => {
    if (currentGoldPrice > 0) {
      calculateStats(currentGoldPrice);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [refreshTrigger, currentGoldPrice, calculateStats]);

  if (isLoading && !prevStats.current) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-8 bg-muted rounded w-32"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const displayStats = stats || prevStats.current!;

  const avg = displayStats.averagePurchasePrice;
  const pure = displayStats.averagePurePurchasePrice;
  const showPurityAdjusted =
    avg > 0 && Math.abs(pure - avg) / avg > 0.0001; // show only if difference > 0.01%

  const investmentDescription = showPurityAdjusted
    ? `Avg: ₹${avg.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/g · Purity-adjusted Avg: ₹${pure.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/g`
    : `Avg: ₹${avg.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/g`;

  const statCards = [
    {
      title: "Total Weight",
      value: `${displayStats.totalWeight.toFixed(3)}g`,
      icon: Weight,
      description: "Gold in portfolio",
    },
    {
      title: "Total Investment",
      value: `₹${displayStats.totalInvestment.toLocaleString("en-IN")}`,
      icon: () => <span className="text-xl">₹</span>,
      description: investmentDescription,
    },
    {
      title: "Current Value",
      value: `₹${displayStats.currentValue.toLocaleString("en-IN")}`,
      icon: () => <span className="text-xl">₹</span>,
      description: `Using 24K rate: ₹${currentGoldPrice.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/g`,
      shimmer: delayedLoading,
    },
    {
      title: "Total Gain/Loss",
      value: `₹${Math.abs(displayStats.totalGain).toLocaleString("en-IN")}`,
      icon: displayStats.totalGain >= 0 ? TrendingUp : TrendingDown,
      description: `${displayStats.gainPercentage.toFixed(2)}%`,
      isGain: displayStats.totalGain >= 0,
      shimmer: delayedLoading,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            {card.shimmer ? (
              <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
            ) : (
              <card.icon
                className={`h-4 w-4 ${
                  card.isGain !== undefined
                    ? card.isGain
                      ? "text-green-500"
                      : "text-red-500"
                    : "text-muted-foreground"
                }`}
              />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                card.shimmer ? "h-8 bg-muted rounded animate-pulse w-32" : ""
              } ${
                card.isGain !== undefined
                  ? card.isGain
                    ? "text-green-500"
                    : "text-red-500"
                  : ""
              }`}
            >
              {!card.shimmer && card.value}
            </div>
            <p className={`text-xs text-muted-foreground ${card.shimmer ? "h-4 w-40 bg-muted rounded animate-pulse mt-2" : ""}`}>
              {!card.shimmer && card.description}
            </p>
            {card.isGain !== undefined && !card.shimmer && (
              <Badge variant={card.isGain ? "default" : "destructive"} className="mt-2">
                {card.isGain ? "Profit" : "Loss"}
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

export { PortfolioSummary };
