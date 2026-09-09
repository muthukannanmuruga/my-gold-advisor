import React, { useEffect, useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface PriceDataPoint {
  date: string;
  displayDate: string;
  silverPrice?: number;
  investment?: number;
  currentValue?: number;
}

type TimeRange = "1week" | "1month" | "3month" | "1year";

const MARKUP = 1.25; // 15% import duty + 10% local charges

const Spinner = () => (
  <div className="flex justify-center items-center h-[300px]">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-400 border-t-transparent" />
  </div>
);

const DualSilverCharts = memo(({ refreshTrigger }: { refreshTrigger: number }) => {
  const [silverPrices, setSilverPrices] = useState<PriceDataPoint[]>([]);
  const [portfolioData, setPortfolioData] = useState<PriceDataPoint[]>([]);
  const [silverTimeRange, setSilverTimeRange] = useState<TimeRange>("1month");
  const [portfolioTimeRange, setPortfolioTimeRange] = useState<TimeRange>("1month");
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "N/A";
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
      case "1week": cutoffDate.setDate(now.getDate() - 7); break;
      case "1month": cutoffDate.setMonth(now.getMonth() - 1); break;
      case "3month": cutoffDate.setMonth(now.getMonth() - 3); break;
      case "1year": cutoffDate.setFullYear(now.getFullYear() - 1); break;
    }
    return cutoffDate.toISOString().split("T")[0];
  };

  const filterDataByTimeRange = (data: PriceDataPoint[], range: TimeRange) => {
    const cutoff = getDateRangeFilter(range);
    return data.filter((item) => item.date >= cutoff);
  };

  const fetchSilverPrices = async (range: TimeRange) => {
    const cutoff = getDateRangeFilter(range);
    const { data, error } = await supabase
      .from("silver_price_history")
      .select("*")
      .gte("created_at", `${cutoff}T00:00:00Z`)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error || !data) return;

    const uniqueMap = new Map<string, PriceDataPoint>();
    data.forEach((entry: any) => {
      const dateKey = String(entry.created_at).split("T")[0];
      if (!uniqueMap.has(dateKey)) {
        const date = new Date(entry.created_at);
        const price = Number(entry.price_inr_per_gram) || 0;
        uniqueMap.set(dateKey, {
          date: dateKey,
          silverPrice: Number.isFinite(price) ? Number((price * MARKUP).toFixed(2)) : 0,
          displayDate: date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          }),
        });
      }
    });
    setSilverPrices(Array.from(uniqueMap.values()));
  };

  const fetchPortfolioData = async () => {
    setPortfolioLoading(true);
    const { data, error } = await supabase
      .from("silver_portfolio_metrics")
      .select("*")
      .order("date", { ascending: true });
    if (error || !data) {
      setPortfolioData([]);
      setPortfolioLoading(false);
      return;
    }

    const uniqueMap = new Map<string, PriceDataPoint>();
    data.forEach((entry: any) => {
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
    setPortfolioLoading(false);
  };

  useEffect(() => {
    fetchSilverPrices(silverTimeRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, silverTimeRange]);

  useEffect(() => {
    fetchPortfolioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const filteredSilverPrices = React.useMemo(
    () => filterDataByTimeRange(silverPrices, silverTimeRange),
    [silverPrices, silverTimeRange]
  );
  const filteredPortfolioData = React.useMemo(
    () => filterDataByTimeRange(portfolioData, portfolioTimeRange),
    [portfolioData, portfolioTimeRange]
  );

  const chartStyle = "w-full lg:w-1/2";

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className={chartStyle}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Silver Price Over Time
              </CardTitle>
              <Select value={silverTimeRange} onValueChange={(v: TimeRange) => setSilverTimeRange(v)}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Range" /></SelectTrigger>
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
            {filteredSilverPrices.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
                No silver price records yet
              </div>
            ) : (
              <ChartContainer config={{ silverPrice: { label: "Silver Price (₹/gram)" } }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredSilverPrices}>
                    <XAxis dataKey="displayDate" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
                    <ChartTooltip content={
                      <ChartTooltipContent formatter={(value, name) => [formatCurrency(value as number), `  ${name}`]} />
                    }/>
                    <Legend />
                    <Line type="monotone" dataKey="silverPrice" stroke="#8884d8" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className={chartStyle}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Portfolio Value Over Time
              </CardTitle>
              <Select value={portfolioTimeRange} onValueChange={(v: TimeRange) => setPortfolioTimeRange(v)}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Range" /></SelectTrigger>
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
            {portfolioLoading ? (
              <Spinner />
            ) : filteredPortfolioData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
                No portfolio records found
              </div>
            ) : (
              <ChartContainer config={{
                investment: { label: "Investment" },
                currentValue: { label: "Current Value" },
              }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredPortfolioData}>
                    <XAxis dataKey="displayDate" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatCurrency} />
                    <ChartTooltip content={
                      <ChartTooltipContent formatter={(value, name) => [formatCurrency(value as number), `  ${name}`]} />
                    }/>
                    <Legend />
                    <Line type="monotone" dataKey="investment" stroke="#8884d8" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="currentValue" stroke="#82ca9d" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

DualSilverCharts.displayName = "DualSilverCharts";

export { DualSilverCharts };
