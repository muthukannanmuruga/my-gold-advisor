import { useState } from "react";
import { AuthWrapper } from "@/components/AuthWrapper";
import { AddPurchaseForm } from "@/components/AddPurchaseForm";
import { PurchasesList } from "@/components/PurchasesList";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { GoldPriceWidget } from "@/components/GoldPriceWidget";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentGoldPrice, setCurrentGoldPrice] = useState(7200); // Default fallback price
  const { toast } = useToast();

  const handlePurchaseAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePurchaseDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 space-y-8">
          {/* Current Gold Price */}
          <GoldPriceWidget onPriceUpdate={setCurrentGoldPrice} />

          {/* Portfolio Summary */}
          <PortfolioSummary 
            refreshTrigger={refreshTrigger} 
            currentGoldPrice={currentGoldPrice} 
          />

          {/* Add Purchase Form */}
          <AddPurchaseForm onPurchaseAdded={handlePurchaseAdded} />

          {/* Purchases List */}
          <PurchasesList 
            refreshTrigger={refreshTrigger} 
            onPurchaseDeleted={handlePurchaseDeleted} 
          />
        </main>
      </div>
    </AuthWrapper>
  );
};

export default Index;
