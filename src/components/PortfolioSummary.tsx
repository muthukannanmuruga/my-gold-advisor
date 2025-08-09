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

const ZERO_TOLERANCE = 0.005;
const STATS_CACHE_KEY = "portfolioStats:v2";
const SHOW_SIGNED_PNL = true;
const MIN_SANE_PRICE_24K_PER_G = 1000;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidStats(s: any): s is PortfolioStats {
  if (!s || typeof s !== "object") return false;
  const keys: (keyof PortfolioStats)[] = [
    "totalWeight",
    "totalInvestment",
    "currentValue",
    "totalGain",
    "gainPercentage",
    "averagePurchasePrice",
    "averagePurePurchasePrice",
    "cagr",
    "purchaseCount",
  ];
  for (const k of keys) {
    if (!(k in s)) return false;
  }
  if (
    !isFiniteNumber(s.totalWeight) ||
    !isFiniteNumber(s.totalInvestment) ||
    !isFiniteNumber(s.currentValue) ||
    !isFiniteNumber(s.totalGain) ||
    !isFiniteNumber(s.gainPercentage) ||
    !isFiniteNumber(s.averagePurchasePrice) ||
    !isFiniteNumber(s.averagePurePurchasePrice) ||
    typeof s.cagr !== "number" ||
    !isFiniteNumber(s.purchaseCount)
  ) {
    return false;
  }
  if (Math.abs((s.currentValue - s.totalInvestment) - s.totalGain) > 0.05) {
    return false;
  }
  if (s.totalWeight < 0 || s.totalInvestment < 0 || s.currentValue < 0) {
    return false;
  }
  return true;
}

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
    localStorage.removeItem("portfolioStats");
    const persisted = localStorage.getItem(STATS_CACHE_KEY);
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted);
        if (isValidStats(parsed)) {
          prevStats.current = parsed as PortfolioStats;
          setStats(parsed as PortfolioStats);
        } else {
          localStorage.removeItem(STATS_CACHE_KEY);
        }
      } catch {
        localStorage.removeItem(STATS_CACHE_KEY);
      }
    }
    setIsLoading(false);
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
          const totalWeight = purchases.reduce((sum: number, p: any) => sum + (p.weight_grams || 0), 0);
          const totalInvestment = purchases.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0);

          const pureGoldWeight = purchases.reduce((sum: number, p: any) => {
            const carat = (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
            return sum + (p.weight_grams || 0) * (carat / 24);
          }, 0);

          const currentValue = purchases.reduce((sum: number, p: any) => {
            const weight = p.weight_grams || 0;
            const carat = (typeof p.carat === "string" ? parseInt(p.carat) : p.carat) ?? 24;
            const purityFactor = carat / 24;
            return sum + weight * price24K * purityFactor;
          }, 0);

          const totalGain = currentValue - totalInvestment;

          let cagrValue = NaN;
          const minCagrDays = 30;
          try {
            const validDates = purchases.filter((p: any) => p.purchase_date);
            if (validDates.length > 0) {
              const earliest = validDates.reduce((min: any, p: any) =>
                new Date(p.purchase_date) < new Date(min.purchase_date) ? p : min
              );
              const startDate = new Date(String(earliest.purchase_date));
              const endDate = new Date();
              const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const diffYears = diffDays / 365.25;

              if (diffYears > 0 && diffDays >= minCagrDays && totalInvestment > 0 && currentValue > 0) {
                cagrValue = (Math.pow(currentValue / totalInvestment, 1 / diffYears) - 1) * 100;
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
            gainPercentage: totalInvestment > 0 ? (totalGain / totalInvestment) * 100 : 0,
            averagePurchasePrice: totalWeight > 0 ? totalInvestment / totalWeight : 0,
            averagePurePurchasePrice: pureGoldWeight > 0 ? totalInvestment / pureGoldWeight : 0,
            cagr: cagrValue,
            purchaseCount: purchases.length,
          };
        }

        const safeRound = (val: number, digits: number) => (Number.isFinite(val) ? Number(val.toFixed(digits)) : val);

        const roundedStats: PortfolioStats = {
          ...newStats,
          totalWeight: safeRound(newStats.totalWeight, 6),
          totalInvestment: safeRound(newStats.totalInvestment, 2),
          currentValue: safeRound(newStats.currentValue, 2),
          totalGain: safeRound(newStats.totalGain, 2),
          gainPercentage: safeRound(newStats.gainPercentage, 2),
          averagePurchasePrice: safeRound(newStats.averagePurchasePrice, 4),
          averagePurePurchasePrice: safeRound(newStats.averagePurePurchasePrice, 4),
          cagr: safeRound(newStats.cagr, 2),
          purchaseCount: newStats.purchaseCount,
        };

        flushSync(() => {
          setStats(roundedStats);
          setIsLoading(false);
        });

        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(roundedStats));
        prevStats.current = roundedStats;

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
    []
  );

  useEffect(() => {
    if (currentGoldPrice > MIN_SANE_PRICE_24K_PER_G) {
      calculateStats(currentGoldPrice);
    } else {
      console.warn("Ignored suspicious currentGoldPrice:", currentGoldPrice);
      setDelayedLoading(false);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [refreshTrigger, currentGoldPrice, calculateStats]);

  const displayStats: PortfolioStats | null =
    !isLoading ? (stats ?? prevStats.current ?? null) : null;

  if (!displayStats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-[148px]">
            <CardContent className="p-4">
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

  const avg = displayStats.averagePurchasePrice;
  const pure = displayStats.averagePurePurchasePrice;
  const showPurityAdjusted =
    isFiniteNumber(avg) && isFiniteNumber(pure) && avg > 0 && Math.abs(pure - avg) / avg > 0.0001;

  const formattedAvg = isFiniteNumber(avg) ? numberFormatter2.format(avg) : "N/A";
  const formattedPure = isFiniteNumber(pure) ? numberFormatter2.format(pure) : "N/A";

  const investmentDescription = showPurityAdjusted ? (
    <div className="flex flex-col gap-0">
      <span>Avg: ₹{formattedAvg}/g</span>
      <span>Pure: ₹{formattedPure}/g</span>
    </div>
  ) : (
    `Avg: ₹${formattedAvg}/g`
  );

  const rawGain = displayStats.totalGain;
  const isZeroGain = isFiniteNumber(rawGain) ? Math.abs(rawGain) < ZERO_TOLERANCE : true;
  const isGain = isFiniteNumber(rawGain) && rawGain > 0 && !isZeroGain;
  const isLoss = isFiniteNumber(rawGain) && rawGain < 0 && !isZeroGain;

  const formatGainValue = (value: number) => {
    if (!isFiniteNumber(value)) return "N/A";
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatINR(Math.abs(value))}`;
  };

  const formatPercentage = (value: number) => {
    if (!isFiniteNumber(value)) return "N/A";
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };

  const statCards = [
    {
      title: "Total Weight",
      value: isFiniteNumber(displayStats.totalWeight)
        ? `${displayStats.totalWeight.toFixed(3)}g`
        : "N/A",
      icon: Weight,
      description: "Gold in portfolio",
      shimmer: false,
    },
    {
      title: "Total Investment",
      value: isFiniteNumber(displayStats.totalInvestment)
        ? formatINR(displayStats.totalInvestment)
        : "N/A",
      icon: () => <span className="text-xl">₹</span>,
      description: investmentDescription,
      shimmer: false,
    },
    {
      title: "Current Value",
      value: isFiniteNumber(displayStats.currentValue)
        ? formatINR(displayStats.currentValue)
        : "N/A",
      icon: () => <span className="text-xl">₹</span>,
      description: `24K rate: ₹${numberFormatter2.format(currentGoldPrice)}/g`,
      shimmer: delayedLoading,
    },
    {
      title: "Total Gain/Loss",
      value: formatGainValue(rawGain),
      icon: isZeroGain ? null : isGain ? TrendingUp : TrendingDown,
      description: formatPercentage(displayStats.gainPercentage),
      isGain,
      isLoss,
      isZero: isZeroGain,
      shimmer: delayedLoading,
    },
    {
      title: "CAGR (Annual)",
      value: Number.isFinite(displayStats.cagr) ? formatPercentage(displayStats.cagr) : "N/A",
      icon: Percent,
      description: "Annualized return",
      isGain: Number.isFinite(displayStats.cagr) && displayStats.cagr >= 0,
      isLoss: Number.isFinite(displayStats.cagr) && displayStats.cagr < 0,
      shimmer: delayedLoading,
    },
    {
      title: "Purchases",
      value: Number.isFinite(displayStats.purchaseCount) ? `${displayStats.purchaseCount}` : "N/A",
      icon: () => <span className="text-xl">#</span>,
      description: "Total gold entries",
      shimmer: false,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {statCards.map((card, index) => {
        const isCagrCard = card.title === "CAGR (Annual)";
        const isGainLossCard = card.title === "Total Gain/Loss";
        
        const iconColorClass =
          (isCagrCard || isGainLossCard) && card.value === "N/A"
            ? "text-black"
            : "isZero" in card && (card as any).isZero
            ? "text-black"
            : "isGain" in card
            ? (card as any).isGain
              ? "text-green-500"
              : "text-red-500"
            : "text-muted-foreground";

        const valueColorClass =
          (isCagrCard || isGainLossCard) && card.value === "N/A"
            ? "text-black"
            : "isZero" in card && (card as any).isZero
            ? "text-black"
            : "isGain" in card
            ? (card as any).isGain
              ? "text-green-500"
              : "text-red-500"
            : "";

        return (
          // 1) Make the Card a column layout
          <Card key={index} className="h-[130px] flex flex-col">

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 min-h-[40px]">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              {card.shimmer ? (
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
              ) : (
                // always render a 16x16 box to keep header height identical
                <div className="h-4 w-4 flex items-center justify-center">
                  {card.icon ? <card.icon className={`h-4 w-4 ${iconColorClass}`} /> : <span className="h-4 w-4 opacity-0" />}
                </div>
              )}
            </CardHeader>

            {/* 2) Content uses a fixed template: value row + desc row */}
            <CardContent className="px-4 pb-0 pt-0 flex-1 flex flex-col">
              {/* Value row — fixed height */}
              <div
                className={
                  `text-2xl font-bold tabular-nums leading-none min-h-[32px] 
                  ${card.shimmer ? "bg-muted rounded animate-pulse w-full" : ""} ${valueColorClass}`
                }
              >
                {!card.shimmer && card.value}
              </div>

              {/* Gap between value and desc so all cards match */}
              <div className="h-1" />

              {/* Description row — fixed 2-line block */}
              <div
                className={
                  `text-xs text-muted-foreground mt-0 min-h-[32px] overflow-hidden 
                  ${card.shimmer ? "bg-muted rounded animate-pulse w-full" : ""}`
                }
              >
                {!card.shimmer && card.description}
              </div>

              {/* (optional) badge sits below; won’t push value up */}
              {"isZero" in card && !card.shimmer && !(card as any).isZero && !SHOW_SIGNED_PNL && (
                <Badge variant={(card as any).isGain ? "default" : "destructive"} className="mt-2 self-start">
                  {(card as any).isGain ? "Profit" : "Loss"}
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