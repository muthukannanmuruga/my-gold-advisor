import { useState } from "react";
import { AuthWrapper } from "@/components/AuthWrapper";
import { AddPurchaseForm } from "@/components/AddPurchaseForm";
import { PurchasesList } from "@/components/PurchasesList";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { GoldPriceWidget } from "@/components/GoldPriceWidget";
import { DualGoldCharts } from "@/components/GoldPriceChart";
import { PortfolioMetricsUpdater } from "@/components/PortfolioMetricsUpdater";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/hooks/useSession";

const Index = () => {
  const [metricsRefresh, setMetricsRefresh] = useState(0);
  const [chartRefresh, setChartRefresh] = useState(0);
  const [currentGoldPrice, setCurrentGoldPrice] = useState<number | null>(null);
  const { toast } = useToast();
  const { session } = useSession();

  const userEmail = session?.user?.email ?? "";
  const username = userEmail
    .split("@")[0]
    .replace(/\./g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const handlePurchaseAdded = () => setMetricsRefresh(prev => prev + 1);
  const handlePurchaseDeleted = () => setMetricsRefresh(prev => prev + 1);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-yellow-500" />
              <h1 className="text-2xl font-bold">Gold Portfolio Tracker</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Welcome Bar */}
        {username && (
          <div className="bg-yellow-100 text-yellow-800 text-sm text-center py-2 font-medium">
            👋 Welcome {username}
          </div>
        )}

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 space-y-8">
          <PortfolioMetricsUpdater
            refreshTrigger={metricsRefresh}
            onMetricsUpdated={() => setChartRefresh(prev => prev + 1)}
          />
          <GoldPriceWidget onPriceUpdate={setCurrentGoldPrice} />
          <PortfolioSummary refreshTrigger={chartRefresh} currentGoldPrice={currentGoldPrice} />
          <DualGoldCharts refreshTrigger={chartRefresh} />
          <AddPurchaseForm onPurchaseAdded={handlePurchaseAdded} />
          <PurchasesList refreshTrigger={chartRefresh} onPurchaseDeleted={handlePurchaseDeleted} />
        </main>
      </div>
    </AuthWrapper>
  );
};

export default Index;
