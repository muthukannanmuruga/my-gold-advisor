// Imports remain unchanged
import { useEffect, useState, useRef, useCallback, memo } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Weight, Percent } from "lucide-react";

// ✅ Renamed xirr → cagr
interface PortfolioStats {
  totalWeight: number;
  totalInvestment: number;
  currentValue: number;
  totalGain: number;
  gainPercentage: number;
  averagePurchasePrice: number;
  averagePurePurchasePrice: number;
  cagr: number; // ✅ Correctly named
  purchaseCount: number;
}

interface PortfolioSummaryProps {
  refreshTrigger: number;
  currentGoldPrice: number;
}

const ZERO_TOLERANCE = 0.005; // ~ half paisa tolerance

const PortfolioSummary = memo(({ refreshTrigger, currentGoldPrice }: PortfolioSummaryProps) => {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [delayedLoading, setDelayedLoading] = useState(true);
  const calculationLock = useRef(false);
  const prevStats = useRef<PortfolioStats | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        .select("*, purchase_date");

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
          cagr: 0,
          purchaseCount: 0,
        };
      } else {
        const totalWeight = purchases.reduce((sum, p) => sum + (p.weight_grams || 0), 0);
        const totalInvestment = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

        const pureGoldWeight = purchases.reduce((sum, p) => {
          const carat = (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
          return sum + (p.weight_grams || 0) * (carat / 24);
        }, 0);

        const currentValue = purchases.reduce((sum, p) => {
          const weight = p.weight_grams || 0;
          const carat = (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
          const purityFactor = carat / 24;
          return sum + weight * price24K * purityFactor;
        }, 0);

        const totalGain = currentValue - totalInvestment;

        // ✅ Correct CAGR calculation
        let cagrValue = 0;
        const minCagrDays = 30; // Minimum days to show CAGR
        try {
          const validDates = purchases.filter(p => p.purchase_date);
          if (validDates.length > 0) {
            const earliest = validDates.reduce((min, p) =>
              new Date(p.purchase_date) < new Date(min.purchase_date) ? p : min
            );
            const startDate = new Date(String(earliest.purchase_date));
            const endDate = new Date();
            const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            const diffYears = diffDays / 365.25;

            if (diffYears > 0 && diffDays >= minCagrDays && totalInvestment > 0 && currentValue > 0) {
              cagrValue = (Math.pow(currentValue / totalInvestment, 1 / diffYears) - 1) * 100;
            } else {
              cagrValue = NaN; // Use NaN to indicate not available
            }
          }
        } catch (err) {
          console.error("CAGR calculation failed", err);
          cagrValue = 0;
        }

        newStats = {
          totalWeight,
          totalInvestment,
          currentValue,
          totalGain,
          gainPercentage: totalInvestment > 0 ? (totalGain / totalInvestment) * 100 : 0,
          averagePurchasePrice: totalWeight > 0 ? totalInvestment / totalWeight : 0,
          averagePurePurchasePrice: pureGoldWeight > 0 ? totalInvestment / pureGoldWeight : 0,
          cagr: isFinite(cagrValue) ? cagrValue : NaN,
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
        cagr: parseFloat(newStats.cagr.toFixed(2)),
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
  const showPurityAdjusted = avg > 0 && Math.abs(pure - avg) / avg > 0.0001;

  const formattedAvg = numberFormatter2.format(avg);
  const formattedPure = numberFormatter2.format(pure);
  const investmentDescription = showPurityAdjusted
    ? `Avg: ₹${formattedAvg}/g · Purity-adjusted Avg: ₹${formattedPure}/g`
    : `Avg: ₹${formattedAvg}/g`;

  // --- Derive gain state with zero-tolerance ---
  const rawGain = displayStats.totalGain;
  const isZeroGain = Math.abs(rawGain) < ZERO_TOLERANCE;
  const isGain = rawGain > 0 && !isZeroGain;
  const isLoss = rawGain < 0 && !isZeroGain;

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
      value: formatINR(Math.abs(rawGain)),
      // ⬇️ Hide icon when zero
      icon: isZeroGain ? null : (isGain ? TrendingUp : TrendingDown),
      description: `${displayStats.gainPercentage.toFixed(2)}%`,
      // Flags for styling/badge logic
      isGain,
      isLoss,
      isZero: isZeroGain,
      shimmer: delayedLoading,
    },
    {
      title: "CAGR (Annual Return)",
      value: isNaN(displayStats.cagr) ? "N/A" : `${displayStats.cagr.toFixed(2)}%`,
      icon: Percent,
      description: "Annualized return (lump sum)",
      isGain: displayStats.cagr >= 0 && !isNaN(displayStats.cagr),
      shimmer: delayedLoading,
    },
    {
      title: "Purchases",
      value: `${displayStats.purchaseCount}`,
      icon: () => <span className="text-xl">#</span>,
      description: "Total number of gold entries",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {statCards.map((card, index) => {
        const isCagrCard = card.title === "CAGR (Annual Return)";
        const isGainLossCard = card.title === "Total Gain/Loss";

        // Determine icon color
        const iconColorClass = isCagrCard && card.value === "N/A"
          ? "text-black"
          : (("isZero" in card && card.isZero)
              ? "text-black"
              : ("isGain" in card
                  ? (card.isGain ? "text-green-500" : "text-red-500")
                  : "text-muted-foreground"));

        // Determine value color
        const valueColorClass = isCagrCard && card.value === "N/A"
          ? "text-black"
          : (("isZero" in card && card.isZero)
              ? "text-black"
              : ("isGain" in card
                  ? (card.isGain ? "text-green-500" : "text-red-500")
                  : ""));

        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              {card.shimmer ? (
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
              ) : (
                // ⬇️ Only render icon when present (won't render for zero gain)
                card.icon ? (
                  <card.icon className={`h-4 w-4 ${iconColorClass}`} />
                ) : (
                  <div className="h-4 w-4" /> // keep layout aligned
                )
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  card.shimmer ? "h-8 bg-muted rounded animate-pulse w-32" : ""
                } ${valueColorClass}`}
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

              {/* ⬇️ Hide Profit/Loss badge when zero */}
              {!("isZero" in card) ? null : (
                !card.shimmer && !card.isZero && (
                  <Badge
                    variant={card.isGain ? "default" : "destructive"}
                    className="mt-2"
                  >
                    {card.isGain ? "Profit" : "Loss"}
                  </Badge>
                )
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

export { PortfolioSummary };
