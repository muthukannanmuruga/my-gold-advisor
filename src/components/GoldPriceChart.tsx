// Charts component with time range filtering
import React, { useEffect, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
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
  realisticPrice24k: number;
  realisticPrice22k: number;
  investment?: number;
  currentValue?: number;
}

interface DualGoldChartsProps {
  refreshTrigger: number;
}

type TimeRange = "1week" | "1month" | "3month" | "1year";

const DualGoldCharts = memo(({ refreshTrigger }: DualGoldChartsProps) => {
  const [goldPrices, setGoldPrices] = useState<PriceDataPoint[]>([]);
  const [portfolioData, setPortfolioData] = useState<PriceDataPoint[]>([]);
  const [goldTimeRange, setGoldTimeRange] = useState<TimeRange>("1month");
  const [portfolioTimeRange, setPortfolioTimeRange] = useState<TimeRange>("1month");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDateRangeFilter = (range: TimeRange) => {
    const now = new Date();
    const cutoffDate = new Date();

    switch (range) {
      case "1week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "1month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "3month":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case "1year":
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return cutoffDate.toISOString().split("T")[0];
  };

  const filterDataByTimeRange = (data: PriceDataPoint[], range: TimeRange) => {
    const cutoffDate = getDateRangeFilter(range);
    return data.filter((item) => item.date >= cutoffDate);
  };

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
        const price24k = Number(entry.price_inr_per_gram) || 0;
        const price22k = Number(entry.price_inr_per_gram_22k || price24k * 22 / 24) || 0;

        // Add 7.5% markup to both prices
        uniqueMap.set(dateKey, {
          date: dateKey,
          realisticPrice24k: Number(((price24k || 0) * 1.075).toFixed(2)),
          realisticPrice22k: Number(((price22k || 0) * 1.075).toFixed(2)),
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
      const dateKey = entry.date;
      if (!uniqueMap.has(dateKey)) {
        const date = new Date(entry.date);
        uniqueMap.set(dateKey, {
          date: dateKey,
          investment: Number(entry.investment) || 0,
          currentValue: Number(entry.current_value) || 0,
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

  useEffect(() => {
    fetchGoldPrices();
    fetchPortfolioData();
  }, [refreshTrigger]);

  const filteredGoldPrices = React.useMemo(
    () => filterDataByTimeRange(goldPrices, goldTimeRange),
    [goldPrices, goldTimeRange]
  );

  const filteredPortfolioData = React.useMemo(
    () => filterDataByTimeRange(portfolioData, portfolioTimeRange),
    [portfolioData, portfolioTimeRange]
  );

  const chartStyle = "w-full lg:w-1/2";

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chart 1: Gold Price Over Time */}
        <Card className={chartStyle}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Gold Price Over Time
              </CardTitle>
              <Select value={goldTimeRange} onValueChange={(value: TimeRange) => setGoldTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1week">1 Week</SelectItem>
                  <SelectItem value="1month">1 Month</SelectItem>
                  <SelectItem value="3month">3 Months</SelectItem>
                  <SelectItem value="1year">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                realisticPrice24k: { label: "24K Realistic Price (₹/gram)", color: "hsl(var(--chart-1))" },
                realisticPrice22k: { label: "22K Realistic Price (₹/gram)", color: "hsl(var(--chart-2))" },
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredGoldPrices}>
                  <XAxis dataKey="displayDate" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [
                          formatCurrency(value as number),
                          // Add a non-breaking space or extra space before the name
                          `  ${name}` // Two non-breaking spaces before name
                        ]}
                      />
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="realisticPrice24k"
                    stroke="var(--color-price24k, #8884d8)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    name="24K Gold"
                  />
                  <Line
                    type="monotone"
                    dataKey="realisticPrice22k"
                    stroke="var(--color-price22k, #82ca9d)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    name="22K Gold"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Chart 2: Portfolio Value Over Time */}
        <Card className={chartStyle}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Portfolio Value Over Time
              </CardTitle>
              <Select value={portfolioTimeRange} onValueChange={(value: TimeRange) => setPortfolioTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1week">1 Week</SelectItem>
                  <SelectItem value="1month">1 Month</SelectItem>
                  <SelectItem value="3month">3 Months</SelectItem>
                  <SelectItem value="1year">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                investment: { label: "Investment" },
                currentValue: { label: "Current Value" },
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredPortfolioData}>
                  <XAxis dataKey="displayDate" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [
                          formatCurrency(value as number),
                          // Add a non-breaking space or extra space before the name
                          `  ${name}` // Two non-breaking spaces before name
                        ]}
                      />
                    }
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
    </div>
  );
});

export { DualGoldCharts };
