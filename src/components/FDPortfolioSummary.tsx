import { useEffect, useState } from "react";
import { Banknote, CalendarCheck, Landmark, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, getFDStatus, getFDValueOnDate, type FixedDeposit } from "@/lib/fixedDeposit";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface Props { refreshTrigger: number }

export const FDPortfolioSummary = ({ refreshTrigger }: Props) => {
  const [deposits, setDeposits] = useState<FixedDeposit[] | null>(null);

  useEffect(() => {
    supabase.from("fixed_deposits").select("*").then(({ data, error }) => {
      if (error) {
        console.error("Error loading FD summary", error);
        setDeposits([]);
        return;
      }
      setDeposits(data ?? []);
    });
  }, [refreshTrigger]);

  if (!deposits) {
    return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Card key={index} className="h-[132px] animate-pulse bg-muted" />)}</div>;
  }

  const tracked = deposits.filter((fd) => getFDStatus(fd) !== "Closed");
  const totalInvestment = tracked.reduce((sum, fd) => sum + Number(fd.principal), 0);
  const currentValue = tracked.reduce((sum, fd) => sum + getFDValueOnDate(fd), 0);
  const returns = currentValue - totalInvestment;
  const active = tracked.filter((fd) => ["Active", "Maturing soon"].includes(getFDStatus(fd))).length;
  const matured = tracked.filter((fd) => getFDStatus(fd) === "Matured").length;
  const cards = [
    { title: "Total Investment", value: formatINR(totalInvestment), detail: "Active and matured principal", icon: Landmark },
    { title: "Current Value", value: formatINR(currentValue), detail: "Interest capped at maturity", icon: Banknote },
    { title: "Total Returns", value: formatINR(returns), detail: totalInvestment ? `${((returns / totalInvestment) * 100).toFixed(2)}% earned` : "0.00% earned", icon: TrendingUp },
    { title: "Count", value: String(tracked.length), detail: `${active} active · ${matured} matured`, icon: CalendarCheck },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, value, detail, icon: Icon }) => (
        <Card key={title} className="h-[132px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
        </Card>
      ))}
    </div>
  );
};
