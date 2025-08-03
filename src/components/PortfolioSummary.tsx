import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
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
  currentGoldPrice: number;
}

export const PortfolioSummary = ({ refreshTrigger, currentGoldPrice }: PortfolioSummaryProps) => {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateStats = async () => {
    try {
      const { data: purchases, error } = await supabase
        .from('gold_purchases')
        .select('*');

      if (error) throw error;

      if (!purchases || purchases.length === 0) {
        setStats({
          totalWeight: 0,
          totalInvestment: 0,
          currentValue: 0,
          totalGain: 0,
          gainPercentage: 0,
          averagePurchasePrice: 0,
        });
        return;
      }

      const totalWeight = purchases.reduce((sum, p) => sum + p.weight_grams, 0);
      const totalInvestment = purchases.reduce((sum, p) => sum + p.total_amount, 0);
      const currentValue = totalWeight * currentGoldPrice;
      const totalGain = currentValue - totalInvestment;
      const gainPercentage = totalInvestment > 0 ? (totalGain / totalInvestment) * 100 : 0;
      const averagePurchasePrice = totalWeight > 0 ? totalInvestment / totalWeight : 0;

      setStats({
        totalWeight,
        totalInvestment,
        currentValue,
        totalGain,
        gainPercentage,
        averagePurchasePrice,
      });
    } catch (error) {
      console.error("Error calculating stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateStats();
  }, [refreshTrigger, currentGoldPrice]);

  if (loading) {
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

  if (!stats) return null;

  const statCards = [
    {
      title: "Total Weight",
      value: `${stats.totalWeight.toFixed(3)}g`,
      icon: Weight,
      description: "Gold in portfolio",
    },
    {
      title: "Total Investment",
      value: `₹${stats.totalInvestment.toLocaleString()}`,
      icon: DollarSign,
      description: `Avg: ₹${stats.averagePurchasePrice.toFixed(2)}/g`,
    },
    {
      title: "Current Value",
      value: `₹${stats.currentValue.toLocaleString()}`,
      icon: DollarSign,
      description: `@ ₹${currentGoldPrice.toFixed(2)}/g`,
    },
    {
      title: "Total Gain/Loss",
      value: `₹${Math.abs(stats.totalGain).toLocaleString()}`,
      icon: stats.totalGain >= 0 ? TrendingUp : TrendingDown,
      description: `${stats.gainPercentage.toFixed(2)}%`,
      isGain: stats.totalGain >= 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${
                card.isGain !== undefined 
                  ? card.isGain 
                    ? 'text-green-500' 
                    : 'text-red-500'
                  : 'text-muted-foreground'
              }`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                card.isGain !== undefined 
                  ? card.isGain 
                    ? 'text-green-500' 
                    : 'text-red-500'
                  : ''
              }`}>
                {card.isGain !== undefined && !card.isGain && '-'}{card.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
              {card.isGain !== undefined && (
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
};