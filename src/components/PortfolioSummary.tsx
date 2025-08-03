import { useEffect, useState, useRef, useCallback, memo } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Weight } from "lucide-react";

interface PortfolioStats {
  totalWeight: number;
  totalInvestment: number;
  currentValue: number;
  totalGain: number;
  gainPercentage: number;
  averagePurchasePrice: number;
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
  const calculationLock = useRef(false);
  const prevStats = useRef<PortfolioStats | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted stats from localStorage on mount for reload handling
  useEffect(() => {
    const persisted = localStorage.getItem("portfolioStats");
    if (persisted) {
      prevStats.current = JSON.parse(persisted);
      setStats(prevStats.current);
      setIsLoading(false);
    }
  }, []);

  const calculateStats = useCallback(async (price24K: number) => {
    if (price24K <= 0 || calculationLock.current) return;

    calculationLock.current = true;
    setIsLoading(true);

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
        };
      } else {
        const totalWeight = purchases.reduce((sum, p) => sum + (p.weight_grams || 0), 0);
        const totalInvestment = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

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
        };
      }

      // Debounce and sync update
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        flushSync(() => {
          setStats(newStats);
          setIsLoading(false);
        });
        prevStats.current = newStats;
        localStorage.setItem("portfolioStats", JSON.stringify(newStats)); // Persist for reloads
      }, 800);
    } catch (err) {
      console.error("Error calculating stats:", err);
      setIsLoading(false);
    } finally {
      calculationLock.current = false;
    }
  }, []); // Empty dependency for memoization

  useEffect(() => {
    calculateStats(currentGoldPrice);
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

  const statCards = [
    {
      title: "Total Weight",
      value: `${displayStats.totalWeight.toFixed(3)}g`,
      icon: Weight,
      description: "Gold in portfolio",
    },
    {
      title: "Total Investment",
      value: `₹${displayStats.totalInvestment.toLocaleString()}`,
      icon: DollarSign,
      description: `Avg: ₹${displayStats.averagePurchasePrice.toFixed(2)}/g`,
    },
    {
      title: "Current Value",
      value: `₹${displayStats.currentValue.toLocaleString()}`,
      icon: DollarSign,
      description: `Using 24K rate: ₹${currentGoldPrice.toFixed(2)}/g`,
    },
    {
      title: "Total Gain/Loss",
      value: `₹${Math.abs(displayStats.totalGain).toLocaleString()}`,
      icon: displayStats.totalGain >= 0 ? TrendingUp : TrendingDown,
      description: `${displayStats.gainPercentage.toFixed(2)}%`,
      isGain: displayStats.totalGain >= 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon
              className={`h-4 w-4 ${
                card.isGain !== undefined
                  ? card.isGain ? "text-green-500" : "text-red-500"
                  : "text-muted-foreground"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                card.isGain !== undefined
                  ? card.isGain ? "text-green-500" : "text-red-500"
                  : ""
              }`}
            >
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
            {card.isGain !== undefined && (
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
