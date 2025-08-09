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
  cagr: number;
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

  const formatINR = useCallback(
    (value: number) => inrFormatter.format(value).replace(/\s?INR/, "₹"),
    [inrFormatter]
  );

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

  const calculateStats = useCallback(
    async (price24K: number) => {
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
            cagr: NaN,
            purchaseCount: 0,
          };
        } else {
          const totalWeight = purchases.reduce((sum, p) => sum + (p.weight_grams || 0), 0);
          const totalInvestment = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

          const pureGoldWeight = purchases.reduce((sum, p) => {
            const carat =
              (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
            return sum + (p.weight_grams || 0) * (carat / 24);
          }, 0);

          const currentValue = purchases.reduce((sum, p) => {
            const weight = p.weight_grams || 0;
            const carat =
              (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
            const purityFactor = carat / 24;
            return sum + weight * price24K * purityFactor;
          }, 0);

          const totalGain = currentValue - totalInvestment;

          // CAGR calculation
          let cagrValue = NaN;
          const minCagrDays = 30;
          try {
            const validDates = purchases.filter((p) => p.purchase_date);
            if (validDates.length > 0) {
              const earliest = validDates.reduce((min, p) =>
                new Date(p.purchase_date) < new Date(min.purchase_date) ? p : min
              );
              const startDate = new Date(String(earliest.purchase_date));
              const endDate = new Date();
              const diffDays =
                (endDate.getTime() - startDate.getTime()) /
                (1000 * 60 * 60 * 24);
              const diffYears = diffDays / 365.25;

              if (
                diffYears > 0 &&
                diffDays >= minCagrDays &&
                totalInvestment > 0 &&
                currentValue > 0
              ) {
                cagrValue =
                  (Math.pow(currentValue / totalInvestment, 1 / diffYears) - 1) *
                  100;
              }
            }
          } catch (err) {
            console.error("CAGR calculation failed", err);
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
            cagr: cagrValue,
            purchaseCount: purchases.length,
          };
        }

        // ✅ Safe rounding – only toFixed when value is finite
        const safeRound = (val: number, digits: number) =>
          Number.isFinite(val) ? Number(val.toFixed(digits)) : val;

        const roundedStats: PortfolioStats = {
          ...newStats,
          totalWeight: safeRound(newStats.totalWeight, 6),
          totalInvestment: safeRound(newStats.totalInvestment, 2),
          currentValue: safeRound(newStats.currentValue, 2),
          totalGain: safeRound(newStats.totalGain, 2),
          gainPercentage: safeRound(newStats.gainPercentage, 2),
          averagePurchasePrice: safeRound(newStats.averagePurchasePrice, 4),
          averagePurePurchasePrice: safeRound(
            newStats.averagePurePurchasePrice,
            4
          ),
          cagr: safeRound(newStats.cagr, 2),
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
    },
    [formatINR]
  );

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
    Number.isFinite(avg) &&
    Number.isFinite(pure) &&
    avg > 0 &&
    Math.abs(pure - avg) / avg > 0.0001;

  const formattedAvg = Number.isFinite(avg)
    ? numberFormatter2.format(avg)
    : "N/A";
  const formattedPure = Number.isFinite(pure)
    ? numberFormatter2.format(pure)
    : "N/A";

  const investmentDescription = showPurityAdjusted
    ? `Avg: ₹${formattedAvg}/g · Purity-adjusted Avg: ₹${formattedPure}/g`
    : `Avg: ₹${formattedAvg}/g`;

  const rawGain = displayStats.totalGain;
  const isZeroGain = Number.isFinite(rawGain)
    ? Math.abs(rawGain) < ZERO_TOLERANCE
    : true;
  const isGain = Number.isFinite(rawGain) && rawGain > 0 && !isZeroGain;
  const isLoss = Number.isFinite(rawGain) && rawGain < 0 && !isZeroGain;

  const statCards = [
    {
      title: "Total Weight",
      value: Number.isFinite(displayStats.totalWeight)
        ? `${displayStats.totalWeight.toFixed(3)}g`
        : "N/A",
      icon: Weight,
      description: "Gold in portfolio",
      shimmer: false,
    },
    {
      title: "Total Investment",
      value: Number.isFinite(displayStats.totalInvestment)
        ? formatINR(displayStats.totalInvestment)
        : "N/A",
      icon: () => <span className="text-xl">₹</span>,
      description: investmentDescription,
      shimmer: false,
    },
    {
      title: "Current Value",
      value: Number.isFinite(displayStats.currentValue)
        ? formatINR(displayStats.currentValue)
        : "N/A",
      icon: () => <span className="text-xl">₹</span>,
      description: `Using 24K rate: ₹${numberFormatter2.format(
        currentGoldPrice
      )}/g`,
      shimmer: delayedLoading,
    },
    {
      title: "Total Gain/Loss",
      value: Number.isFinite(rawGain) ? formatINR(Math.abs(rawGain)) : "N/A",
      icon: isZeroGain ? null : isGain ? TrendingUp : TrendingDown,
      description: Number.isFinite(displayStats.gainPercentage)
        ? `${displayStats.gainPercentage.toFixed(2)}%`
        : "N/A",
      isGain,
      isLoss,
      isZero: isZeroGain,
      shimmer: delayedLoading,
    },
    {
      title: "CAGR (Annual Return)",
      value: Number.isFinite(displayStats.cagr)
        ? `${displayStats.cagr.toFixed(2)}%`
        : "N/A",
      icon: Percent,
      description: "Annualized return (lump sum)",
      isGain: Number.isFinite(displayStats.cagr) && displayStats.cagr >= 0,
      shimmer: delayedLoading,
    },
    {
      title: "Purchases",
      value: Number.isFinite(displayStats.purchaseCount)
        ? `${displayStats.purchaseCount}`
        : "N/A",
      icon: () => <span className="text-xl">#</span>,
      description: "Total number of gold entries",
      shimmer: false,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {statCards.map((card, index) => {
        const isCagrCard = card.title === "CAGR (Annual Return)";
        const iconColorClass =
          isCagrCard && card.value === "N/A"
            ? "text-black"
            : "isZero" in card && card.isZero
            ? "text-black"
            : "isGain" in card
            ? card.isGain
              ? "text-green-500"
              : "text-red-500"
            : "text-muted-foreground";

        const valueColorClass =
          isCagrCard && card.value === "N/A"
            ? "text-black"
            : "isZero" in card && card.isZero
            ? "text-black"
            : "isGain" in card
            ? card.isGain
              ? "text-green-500"
              : "text-red-500"
            : "";

        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              {card.shimmer ? (
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
              ) : card.icon ? (
                <card.icon className={`h-4 w-4 ${iconColorClass}`} />
              ) : (
                <div className="h-4 w-4" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  card.shimmer
                    ? "h-8 bg-muted rounded animate-pulse w-32"
                    : ""
                } ${valueColorClass}`}
              >
                {!card.shimmer && card.value}
              </div>
              <p
                className={`text-xs text-muted-foreground ${
                  card.shimmer
                    ? "h-4 w-40 bg-muted rounded animate-pulse mt-2"
                    : ""
                }`}
              >
                {!card.shimmer && card.description}
              </p>
              {"isZero" in card && !card.shimmer && !card.isZero && (
                <Badge
                  variant={card.isGain ? "default" : "destructive"}
                  className="mt-2"
                >
                  {card.isGain ? "Profit" : "Loss"}
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

export { PortfolioSummary };
