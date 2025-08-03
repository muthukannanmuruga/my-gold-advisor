import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useToast } from "./ui/use-toast";

interface GoldPriceData {
  priceInrPerGram: number;
  priceUsdPerOunce: number;
  lastUpdated: string;
  source: string;
  error?: string;
}

interface GoldPriceWidgetProps {
  onPriceUpdate: (price: number) => void;
}

export const GoldPriceWidget = ({ onPriceUpdate }: GoldPriceWidgetProps) => {
  const [priceData, setPriceData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchGoldPrice = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-gold-price');
      
      if (error) throw error;
      
      setPriceData(data);
      onPriceUpdate(data.priceInrPerGram);
      
      if (data.error) {
        toast({
          title: "Using fallback price",
          description: data.error,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error fetching gold price:", error);
      toast({
        title: "Error",
        description: "Failed to fetch current gold price",
        variant: "destructive",
      });
      
      // Use fallback price
      const fallbackData = {
        priceInrPerGram: 7200,
        priceUsdPerOunce: 2650,
        lastUpdated: new Date().toISOString(),
        source: 'fallback',
        error: 'API unavailable'
      };
      setPriceData(fallbackData);
      onPriceUpdate(fallbackData.priceInrPerGram);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldPrice();
    
    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchGoldPrice, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !priceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Current Gold Price
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted rounded w-32"></div>
            <div className="h-4 bg-muted rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            Current Gold Price
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchGoldPrice}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Live market rates • Last updated: {' '}
          {priceData ? new Date(priceData.lastUpdated).toLocaleTimeString() : 'Loading...'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {priceData && (
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold text-yellow-600">
                ₹{priceData.priceInrPerGram.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">per gram</div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={priceData.source === 'fallback' ? 'secondary' : 'default'}>
                {priceData.source === 'fallback' ? 'Estimated' : 'Live'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ${priceData.priceUsdPerOunce}/oz USD
              </span>
            </div>
            
            {priceData.error && (
              <div className="text-xs text-amber-600">
                {priceData.error}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};