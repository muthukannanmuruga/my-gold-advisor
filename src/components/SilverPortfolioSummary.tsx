import { useCallback, useEffect, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, TrendingDown, Weight, Percent } from "lucide-react";

interface Stats {
  totalWeight: number;
  totalInvestment: number;
  currentValue: number;
  totalGain: number;
  gainPercentage: number;
  averagePurchasePrice: number;
  cagr: number;
  purchaseCount: number;
}

interface Props {
  refreshTrigger: number;
  currentSilverPrice: number;
}

const ZERO_TOLERANCE = 0.005;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const SilverPortfolioSummary = memo(({ refreshTrigger, currentSilverPrice }: Props) => {
  const [stats, setStats] = useState<Stats | null>(null);

  const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const num2 = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatINR = (v: number) => inr.format(v).replace(/\s?INR/, "₹");

  const calculate = useCallback(async (price: number) => {
    const { data: purchases, error } = await supabase.from("silver_purchases").select("*");
    if (error) {
      console.error("Error loading silver purchases", error);
      return;
    }

    if (!purchases?.length) {
      setStats({
        totalWeight: 0,
        totalInvestment: 0,
        currentValue: 0,
        totalGain: 0,
        gainPercentage: 0,
        averagePurchasePrice: 0,
        cagr: NaN,
        purchaseCount: 0,
      });
      return;
    }

    const totalWeight = purchases.reduce((s: number, p: any) => s + (Number(p.weight_grams) || 0), 0);
    const totalInvestment = purchases.reduce((s: number, p: any) => s + (Number(p.total_amount) || 0), 0);
    const currentValue = purchases.reduce((s: number, p: any) => {
      const purity = Number(p.purity) || 100;
      return s + (Number(p.weight_grams) || 0) * price * (purity / 100);
    }, 0);
    const totalGain = currentValue - totalInvestment;

    let cagr = NaN;
    const withDates = purchases.filter((p: any) => p.purchase_date);
    if (withDates.length) {
      const earliest = withDates.reduce((min: any, p: any) =>
        new Date(p.purchase_date) < new Date(min.purchase_date) ? p : min
      );
      const diffDays =
        (Date.now() - new Date(String(earliest.purchase_date)).getTime()) / (1000 * 60 * 60 * 24);
      const diffYears = diffDays / 365.25;
      if (diffDays >= 30 && diffYears > 0 && totalInvestment > 0 && currentValue > 0) {
        cagr = (Math.pow(currentValue / totalInvestment, 1 / diffYears) - 1) * 100;
      }
    }

    setStats({
      totalWeight,
      totalInvestment,
      currentValue,
      totalGain,
      gainPercentage: totalInvestment > 0 ? (totalGain / totalInvestment) * 100 : 0,
      averagePurchasePrice: totalWeight > 0 ? totalInvestment / totalWeight : 0,
      cagr,
      purchaseCount: purchases.length,
    });
  }, []);

  useEffect(() => {
    if (currentSilverPrice > 0) calculate(currentSilverPrice);
  }, [refreshTrigger, currentSilverPrice, calculate]);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-[130px]">
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

  const rawGain = stats.totalGain;
  const isZeroGain = Math.abs(rawGain) < ZERO_TOLERANCE;
  const isGain = rawGain > 0 && !isZeroGain;

  const formatGainValue = (v: number) => {
    if (!isFiniteNumber(v)) return "N/A";
    const sign = v > 0 ? "+" : v < 0 ? "-" : "";
    return `${sign}${formatINR(Math.abs(v))}`;
  };
  const formatPercentage = (v: number) => {
    if (!isFiniteNumber(v)) return "N/A";
    const sign = v > 0 ? "+" : v < 0 ? "-" : "";
    return `${sign}${Math.abs(v).toFixed(2)}%`;
  };

  const cards = [
    {
      title: "Total Weight",
      value: `${stats.totalWeight.toFixed(3)}g`,
      icon: Weight,
      description: "Silver in portfolio",
    },
    {
      title: "Total Investment",
      value: formatINR(stats.totalInvestment),
      icon: () => <span className="text-xl">₹</span>,
      description: `Avg: ₹${num2.format(stats.averagePurchasePrice)}/g`,
    },
    {
      title: "Current Value",
      value: formatINR(stats.currentValue),
      icon: () => <span className="text-xl">₹</span>,
      description: `Pure rate: ₹${num2.format(currentSilverPrice)}/g`,
    },
    {
      title: "Total Gain/Loss",
      value: formatGainValue(rawGain),
      icon: isZeroGain ? null : isGain ? TrendingUp : TrendingDown,
      description: formatPercentage(stats.gainPercentage),
      isGain,
      isZero: isZeroGain,
    },
    {
      title: "CAGR (Annual)",
      value: Number.isFinite(stats.cagr) ? formatPercentage(stats.cagr) : "N/A",
      icon: Percent,
      description: "Annualized return",
      isGain: Number.isFinite(stats.cagr) && stats.cagr >= 0,
    },
    {
      title: "Purchases",
      value: `${stats.purchaseCount}`,
      icon: () => <span className="text-xl">#</span>,
      description: "Total silver entries",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => {
        const colorClass =
          card.value === "N/A"
            ? "text-black"
            : "isZero" in card && (card as any).isZero
            ? "text-black"
            : "isGain" in card
            ? (card as any).isGain
              ? "text-green-500"
              : "text-red-500"
            : "";

        return (
          <Card key={index} className="h-[130px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 min-h-[40px]">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className="h-4 w-4 flex items-center justify-center">
                {card.icon ? (
                  <card.icon className={`h-4 w-4 ${colorClass || "text-muted-foreground"}`} />
                ) : (
                  <span className="h-4 w-4 opacity-0" />
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-0 pt-0 flex-1 flex flex-col">
              <div className={`text-2xl font-bold tabular-nums leading-none min-h-[32px] ${colorClass}`}>
                {card.value}
              </div>
              <div className="h-1" />
              <div className="text-xs text-muted-foreground mt-0 min-h-[32px] overflow-hidden">
                {card.description}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

SilverPortfolioSummary.displayName = "SilverPortfolioSummary";

export { SilverPortfolioSummary };
