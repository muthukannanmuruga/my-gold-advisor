// New component to render both charts side by side
import { useEffect, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface PriceDataPoint {
  date: string;
  displayDate: string;
  price: number;
  investment?: number;
  currentValue?: number;
}

interface DualGoldChartsProps {
  refreshTrigger: number;
}

const DualGoldCharts = memo(({ refreshTrigger }: DualGoldChartsProps) => {
  const [goldPrices, setGoldPrices] = useState<PriceDataPoint[]>([]);
  const [portfolioData, setPortfolioData] = useState<PriceDataPoint[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  useEffect(() => {
    const fetchGoldPrices = async () => {
      const { data, error } = await supabase
        .from("gold_price_history")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !data) return;

      const uniqueMap = new Map();

      data.forEach((entry) => {
        const dateKey = entry.created_at.split("T")[0];
        if (!uniqueMap.has(dateKey)) {
          const date = new Date(entry.created_at);
          uniqueMap.set(dateKey, {
            date: dateKey,
            price: Number(entry.price_inr_per_gram),
            displayDate: date.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            }),
          });
        }
      });

      setGoldPrices(Array.from(uniqueMap.values()));
    };

    const fetchPortfolioData = async () => {
      const { data, error } = await supabase
        .from("portfolio_metrics")
        .select("*")
        .order("date", { ascending: true });

      if (error || !data) return;

      const uniqueMap = new Map();

      data.forEach((entry) => {
        const dateKey = entry.date.split("T")[0];
        if (!uniqueMap.has(dateKey)) {
          const date = new Date(entry.date);
          uniqueMap.set(dateKey, {
            date: dateKey,
            investment: Number(entry.investment),
            currentValue: Number(entry.current_value),
            displayDate: date.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            }),
          });
        }
      });

      setPortfolioData(Array.from(uniqueMap.values()));
    };

    fetchGoldPrices();
    fetchPortfolioData();
  }, [refreshTrigger]);

  const chartStyle = "w-full lg:w-1/2";

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Chart 1: Gold Price Over Time */}
      <Card className={chartStyle}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gold Price Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ price: { label: "Gold Price (\u20B9/gram)", color: "hsl(var(--chart-1))" } }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={goldPrices}>
                <XAxis dataKey="displayDate" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(value) => [formatCurrency(value as number), "Gold Price"]} />}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--color-price)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-price)", strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Chart 2: Investment vs Current Value */}
      <Card className={chartStyle}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Portfolio Value Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ investment: { label: "Investment" }, currentValue: { label: "Current Value" } }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={portfolioData}>
                <XAxis dataKey="displayDate" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(value, name) => [formatCurrency(value as number), name]} />}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="investment"
                  stroke="var(--color-investment, #8884d8)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="currentValue"
                  stroke="var(--color-currentValue, #82ca9d)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
});

export { DualGoldCharts };
