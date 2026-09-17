import { useEffect, useState } from "react";
import { CalendarCheck, Percent, TrendingDown, TrendingUp } from "lucide-react";
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
    return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Card key={index} className="h-[132px] animate-pulse bg-muted" />)}</div>;
  }

  const tracked = deposits.filter((fd) => getFDStatus(fd) !== "Closed");
  const totalInvestment = tracked.reduce((sum, fd) => sum + Number(fd.principal), 0);
  const currentValue = tracked.reduce((sum, fd) => sum + getFDValueOnDate(fd), 0);
  const returns = currentValue - totalInvestment;
  const returnPercentage = totalInvestment ? (returns / totalInvestment) * 100 : 0;
  const isZeroReturns = Math.abs(returns) < 0.005;
  const isGain = returns > 0 && !isZeroReturns;

  const formatReturnValue = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatINR(Math.abs(value))}`;
  };

  const formatReturnPercentage = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };

  const maturingSoon = tracked.filter((fd) => getFDStatus(fd) === "Maturing soon").length;
  const matured = tracked.filter((fd) => getFDStatus(fd) === "Matured").length;
  const cards = [
    { title: "Total Investment", value: formatINR(totalInvestment), detail: "Active and matured principal", icon: () => <span className="text-xl">₹</span> },
    { title: "Current Value", value: formatINR(currentValue), detail: "Interest capped at maturity", icon: () => <span className="text-xl">₹</span> },
    { title: "Total Returns", value: formatReturnValue(returns), detail: "", icon: isZeroReturns ? null : isGain ? TrendingUp : TrendingDown, isGain, isZero: isZeroReturns },
    { title: "Total Returns %", value: formatReturnPercentage(returnPercentage), detail: "", icon: Percent, isGain, isZero: isZeroReturns },
    { title: "Count", value: String(tracked.length), detail: <><span className="text-warning">{maturingSoon} Maturing Soon</span> · <span className="text-destructive">{matured} Matured</span></>, icon: CalendarCheck },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map(({ title, value, detail, icon: Icon, isGain: cardIsGain, isZero }) => {
        const colorClass = isZero ? "text-black" : cardIsGain === undefined ? "" : cardIsGain ? "text-green-500" : "text-red-500";

        return (
        <Card key={title} className="h-[132px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className={`h-4 w-4 flex items-center justify-center ${colorClass || "text-muted-foreground"}`}>
              {Icon ? <Icon className="h-4 w-4" /> : <span className="h-4 w-4 opacity-0" />}
            </div>
          </CardHeader>
          <CardContent><div className={`${title === "Total Returns" ? "text-xl" : "text-2xl"} font-bold tabular-nums whitespace-nowrap ${colorClass}`}>{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
        </Card>
        );
      })}
    </div>
  );
};
