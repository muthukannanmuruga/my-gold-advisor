import { useEffect, useState, useRef, useCallback, memo } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Weight, Percent } from "lucide-react";

interface PortfolioStats {
  totalWeight: number;
  totalInvestment: number;
  currentValue: number;
  totalGain: number;
  gainPercentage: number;
  averagePurchasePrice: number;
  averagePurePurchasePrice: number;
  xirr: number;
  purchaseCount: number;
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

  // Formatters (stable)
  const inrFormatter = useRef(
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  ).current;

  const numberFormatter2 = useRef(
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  ).current;

  const formatINR = useCallback((value: number) => {
    return inrFormatter.format(value).replace(/\s?INR/, "₹");
  }, [inrFormatter]);

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
          xirr: 0,
          purchaseCount: 0,
        };
      } else {
        const totalWeight = purchases.reduce(
          (sum, p) => sum + (p.weight_grams || 0),
          0
        );
        const totalInvestment = purchases.reduce(
          (sum, p) => sum + (p.total_amount || 0),
          0
        );

        const pureGoldWeight = purchases.reduce((sum, p) => {
          const carat = (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
          return sum + (p.weight_grams || 0) * (carat / 24);
        }, 0);

        // --- REVERTED CURRENT VALUE LOGIC (no 7.5% premium, just purity adjustment) ---
        const currentValue = purchases.reduce((sum, p) => {
          const weight = p.weight_grams || 0;
          const carat = (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
          const purityFactor = carat / 24; // Supports all carats
          return sum + weight * price24K * purityFactor;
        }, 0);

        const totalGain = currentValue - totalInvestment;

        // XIRR Approximation
        let xirrValue = 0;
        try {
          if (purchases.length > 0 && currentValue > 0) {
            const oldestPurchase = purchases.reduce((oldest, p) =>
              new Date(p.purchase_date) < new Date(oldest.purchase_date) ? p : oldest
            );

            const daysSinceFirst = Math.max(
              1,
              (new Date().getTime() -
                new Date(oldestPurchase.purchase_date).getTime()) /
                (1000 * 60 * 60 * 24)
            );

            const totalReturn = (currentValue - totalInvestment) / totalInvestment;
            const yearsInvested = daysSinceFirst / 365.25;

            if (yearsInvested > 0) {
              xirrValue = (Math.pow(1 + totalReturn, 1 / yearsInvested) - 1) * 100;
              if (!isFinite(xirrValue)) xirrValue = 0;
            }
          }
        } catch (error) {
          console.log("XIRR calculation failed:", error);
          xirrValue = 0;
        }

        newStats = {
          totalWeight,
          totalInvestment,
          currentValue,
          totalGain,
          gainPercentage:
            totalInvestment > 0
              ? (totalGain / totalInvestment) * 100
              : 0,
          averagePurchasePrice:
            totalWeight > 0 ? totalInvestment / totalWeight : 0,
          averagePurePurchasePrice:
            pureGoldWeight > 0 ? totalInvestment / pureGoldWeight : 0,
          xirr: xirrValue,
          purchaseCount: purchases.length,
        };
      }

      const roundedStats: PortfolioStats = {
        ...newStats,
        totalWeight: parseFloat(newStats.totalWeight.toFixed(6)),
        totalInvestment: parseFloat(newStats.totalInvestment.toFixed(2)),
        currentValue: parseFloat(newStats.currentValue.toFixed(2)),
        totalGain: parseFloat(newStats.totalGain.toFixed(2)),
        gainPercentage: parseFloat(newStats.gainPercentage.toFixed(2)),
        averagePurchasePrice: parseFloat(newStats.averagePurchasePrice.toFixed(4)),
        averagePurePurchasePrice: parseFloat(newStats.averagePurePurchasePrice.toFixed(4)),
        xirr: parseFloat(newStats.xirr.toFixed(2)),
        purchaseCount: newStats.purchaseCount,
      };

      flushSync(() => {
        setStats(roundedStats);
        setIsLoading(false);
      });

      prevStats.current = roundedStats;
      localStorage.setItem("portfolioStats", JSON.stringify(roundedStats));

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
  }, [formatINR]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
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
    avg > 0 && Math.abs(pure - avg) / avg > 0.0001;

  const formattedAvg = numberFormatter2.format(avg);
  const formattedPure = numberFormatter2.format(pure);
  const investmentDescription = showPurityAdjusted
    ? `Avg: ₹${formattedAvg}/g · Purity-adjusted Avg: ₹${formattedPure}/g`
    : `Avg: ₹${formattedAvg}/g`;

  const statCards = [
    {
      title: "Total Weight",
      value: `${displayStats.totalWeight.toFixed(3)}g`,
      icon: Weight,
      description: "Gold in portfolio",
    },
    {
      title: "Total Investment",
      value: formatINR(displayStats.totalInvestment),
      icon: () => <span className="text-xl">₹</span>,
      description: investmentDescription,
    },
    {
      title: "Current Value",
      value: formatINR(displayStats.currentValue),
      icon: () => <span className="text-xl">₹</span>,
      description: `Using 24K rate: ₹${numberFormatter2.format(currentGoldPrice)}/g`,
      shimmer: delayedLoading,
    },
    {
      title: "Total Gain/Loss",
      value: formatINR(Math.abs(displayStats.totalGain)),
      icon: displayStats.totalGain >= 0 ? TrendingUp : TrendingDown,
      description: `${displayStats.gainPercentage.toFixed(2)}%`,
      isGain: displayStats.totalGain >= 0,
      shimmer: delayedLoading,
    },
    {
      title: "XIRR (Annual Return)",
      value: `${displayStats.xirr.toFixed(2)}%`,
      icon: Percent,
      description: "Annualized return rate",
      isGain: displayStats.xirr >= 0,
      shimmer: delayedLoading,
    },
    {
      title: "Purchases",
      value: `${displayStats.purchaseCount}`,
      icon: () => <span className="text-xl">#</span>,
      description: "Total number of gold entries",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
            <p
              className={`text-xs text-muted-foreground ${
                card.shimmer ? "h-4 w-40 bg-muted rounded animate-pulse mt-2" : ""
              }`}
            >
              {!card.shimmer && card.description}
            </p>
            {card.isGain !== undefined && !card.shimmer && (
              <Badge
                variant={card.isGain ? "default" : "destructive"}
                className="mt-2"
              >
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
