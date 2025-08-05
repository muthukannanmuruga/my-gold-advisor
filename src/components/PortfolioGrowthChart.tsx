import { useEffect, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface GrowthDataPoint {
  date: string;
  investment: number;
  currentValue: number;
  displayDate: string;
}

interface PortfolioGrowthChartProps {
  refreshTrigger: number;
  currentGoldPrice: number;
}

const chartConfig = {
  investment: {
    label: "Total Investment",
    color: "hsl(var(--chart-1))",
  },
  currentValue: {
    label: "Current Value", 
    color: "hsl(var(--chart-2))",
  },
};

const PortfolioGrowthChart = memo(({ refreshTrigger, currentGoldPrice }: PortfolioGrowthChartProps) => {
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateGrowthData = async () => {
      if (currentGoldPrice <= 0) return;
      
      setIsLoading(true);
      try {
        const { data: purchases, error } = await supabase
          .from("gold_purchases")
          .select("*")
          .order("purchase_date", { ascending: true });

        if (error) throw error;

        if (!purchases?.length) {
          setGrowthData([]);
          setIsLoading(false);
          return;
        }

        // Calculate cumulative values at each purchase date
        const dataPoints: GrowthDataPoint[] = [];
        let cumulativeInvestment = 0;

        purchases.forEach((purchase, index) => {
          cumulativeInvestment += purchase.total_amount || 0;

          // Calculate current value of all purchases up to this point
          const currentValue = purchases.slice(0, index + 1).reduce((sum, p) => {
            const purityFactor = (p.carat ?? 24) / 24;
            return sum + (p.weight_grams || 0) * currentGoldPrice * purityFactor;
          }, 0);

          const date = new Date(purchase.purchase_date);
          dataPoints.push({
            date: purchase.purchase_date,
            investment: cumulativeInvestment,
            currentValue: currentValue,
            displayDate: date.toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short',
              year: '2-digit'
            }),
          });
        });

        // Add current date point if last purchase was not today
        const lastPurchaseDate = new Date(purchases[purchases.length - 1].purchase_date);
        const today = new Date();
        const daysDiff = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 0) {
          const totalCurrentValue = purchases.reduce((sum, p) => {
            const purityFactor = (p.carat ?? 24) / 24;
            return sum + (p.weight_grams || 0) * currentGoldPrice * purityFactor;
          }, 0);

          dataPoints.push({
            date: today.toISOString().split('T')[0],
            investment: cumulativeInvestment,
            currentValue: totalCurrentValue,
            displayDate: today.toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short',
              year: '2-digit'
            }),
          });
        }

        setGrowthData(dataPoints);
      } catch (error) {
        console.error("Error calculating growth data:", error);
        setGrowthData([]);
      } finally {
        setIsLoading(false);
      }
    };

    calculateGrowthData();
  }, [refreshTrigger, currentGoldPrice]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Portfolio Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!growthData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Portfolio Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="text-muted-foreground">No purchase data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Portfolio Growth Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={growthData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="displayDate" 
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={formatCurrency}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name) => [
                      formatCurrency(value as number),
                      chartConfig[name as keyof typeof chartConfig]?.label || name
                    ]}
                  />
                }
              />
              <Line 
                type="monotone" 
                dataKey="investment" 
                stroke="var(--color-investment)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-investment)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "var(--color-investment)", strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="currentValue" 
                stroke="var(--color-currentValue)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-currentValue)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "var(--color-currentValue)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

export { PortfolioGrowthChart };