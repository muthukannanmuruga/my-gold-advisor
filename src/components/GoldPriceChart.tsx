import { useEffect, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface PriceDataPoint {
  date: string;
  price: number;
  displayDate: string;
}

interface GoldPriceChartProps {
  refreshTrigger: number;
}

const chartConfig = {
  price: {
    label: "Gold Price (₹/gram)",
    color: "hsl(var(--chart-1))",
  },
};

const GoldPriceChart = memo(({ refreshTrigger }: GoldPriceChartProps) => {
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      setIsLoading(true);
      try {
        const { data: priceHistory, error } = await supabase
          .from("gold_price_history")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (!priceHistory?.length) {
          setPriceData([]);
          setIsLoading(false);
          return;
        }

        const dataPoints: PriceDataPoint[] = priceHistory.map((entry) => {
          const date = new Date(entry.created_at);
          return {
            date: entry.created_at,
            price: Number(entry.price_inr_per_gram),
            displayDate: date.toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short',
              year: '2-digit'
            }),
          };
        });

        setPriceData(dataPoints);
      } catch (error) {
        console.error("Error fetching price history:", error);
        setPriceData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriceHistory();
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gold Price Over Time
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

  if (!priceData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gold Price Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="text-muted-foreground">No price history available</div>
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
          Gold Price Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                dataKey="price" 
                stroke="var(--color-price)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-price)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "var(--color-price)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

export { GoldPriceChart };