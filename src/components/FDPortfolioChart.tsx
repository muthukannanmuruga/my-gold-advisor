import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/fixedDeposit";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type Range = "1week" | "1month" | "3month" | "1year";
interface Point { date: string; displayDate: string; investment: number; currentValue: number }

const cutoffFor = (range: Range) => {
  const date = new Date();
  if (range === "1week") date.setDate(date.getDate() - 7);
  if (range === "1month") date.setMonth(date.getMonth() - 1);
  if (range === "3month") date.setMonth(date.getMonth() - 3);
  if (range === "1year") date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
};

export const FDPortfolioChart = ({ refreshTrigger }: { refreshTrigger: number }) => {
  const [range, setRange] = useState<Range>("1year");
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from("fd_portfolio_metrics").select("date,investment,current_value").gte("date", cutoffFor(range)).order("date").limit(2000).then(({ data, error }) => {
      if (error) console.error("Error loading FD chart", error);
      setPoints((data ?? []).map((item) => ({
        date: item.date,
        displayDate: new Date(`${item.date}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }),
        investment: Number(item.investment),
        currentValue: Number(item.current_value),
      })));
      setLoading(false);
    });
  }, [range, refreshTrigger]);

  const data = useMemo(() => points.filter((point) => point.date >= cutoffFor(range)), [points, range]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> FD Portfolio Value Over Time</CardTitle>
        <Select value={range} onValueChange={(value: Range) => setRange(value)}><SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1week">1 Week</SelectItem><SelectItem value="1month">1 Month</SelectItem><SelectItem value="3month">3 Months</SelectItem><SelectItem value="1year">1 Year</SelectItem></SelectContent></Select>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex h-[300px] items-center justify-center text-muted-foreground">Loading portfolio history...</div> : data.length === 0 ? <div className="flex h-[300px] items-center justify-center text-muted-foreground">No FD history yet</div> : (
          <ChartContainer className="h-[300px] w-full aspect-auto" config={{ investment: { label: "Investment", color: "hsl(var(--chart-1))" }, currentValue: { label: "Current Value", color: "hsl(var(--chart-2))" } }}>
            <LineChart data={data} margin={{ left: 8, right: 12 }}>
              <XAxis dataKey="displayDate" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatINR(Number(value))} width={104} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{name === "investment" ? "Investment" : "Current Value"}</span><span className="ml-auto font-mono font-medium">{formatINR(Number(value))}</span></>} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="investment" stroke="var(--color-investment)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="currentValue" stroke="var(--color-currentValue)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
