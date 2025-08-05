import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useToast } from "./ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GoldApiResponse {
  price_gram_24k?: number;
  price_gram_22k?: number;
  price?: number; // INR per troy ounce
  lastUpdated?: string;
}

interface GoldPriceData {
  priceInrPerGram24K: number;
  priceInrPerGram22K: number;
  lastUpdated: string;
  source: string;
  error?: string;
}

interface GoldPriceWidgetProps {
  onPriceUpdate: (price24K: number) => void;
}

type Purity = 24 | 22;

const GOLDAPI_URL = "https://www.goldapi.io/api/XAU/INR";
const GOLDAPI_KEY = "goldapi-1424smdvlf2mb-io";

const IMPORT_DUTY_RATE = 0.06;
const LOCAL_CHARGES_RATE = 0.015;

export const GoldPriceWidget = ({ onPriceUpdate }: GoldPriceWidgetProps) => {
  const [priceData, setPriceData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purity, setPurity] = useState<Purity>(22);
  const { toast } = useToast();

  const resolveBasePrice = (data: GoldPriceData, purity: Purity) => {
    return purity === 24 ? data.priceInrPerGram24K : data.priceInrPerGram22K;
  };

  const computeBreakdown = (base: number) => {
    return {
      base,
      importDuty: base * IMPORT_DUTY_RATE,
      localCharges: base * LOCAL_CHARGES_RATE,
      total: base * (1 + IMPORT_DUTY_RATE + LOCAL_CHARGES_RATE),
    };
  };

  const fetchGoldPrice = async () => {
    setLoading(true);
    try {
      const resp = await fetch(GOLDAPI_URL, {
        headers: { "x-access-token": GOLDAPI_KEY, Accept: "application/json" },
      });

      if (!resp.ok) throw new Error(`GoldAPI HTTP ${resp.status}`);

      const json: GoldApiResponse = await resp.json();

      // Calculate prices
      let price24K = json.price_gram_24k ?? 
                    (json.price ? json.price / 31.1035 : null);
      let price22K = json.price_gram_22k ?? 
                    (price24K ? (22 / 24) * price24K : null);

      if (!price24K || !price22K) {
        throw new Error("Incomplete gold price data from API");
      }

      const data: GoldPriceData = {
        priceInrPerGram24K: Number(price24K.toFixed(2)),
        priceInrPerGram22K: Number(price22K.toFixed(2)),
        lastUpdated: new Date().toISOString(),
        source: "GoldAPI INR endpoint",
      };

      setPriceData(data);
      
      // Store price in history table
      try {
        await supabase.from("gold_price_history").insert({
          price_inr_per_gram: data.priceInrPerGram24K,
          source: data.source
        });
      } catch (historyError) {
        console.error("Error storing price history:", historyError);
      }
      
      // Always send 24K price to parent for portfolio calculations
      onPriceUpdate(computeBreakdown(data.priceInrPerGram24K).total);

    } catch (err: any) {
      console.error("Error fetching gold price:", err);
      toast({
        title: "Error",
        description: "Failed to fetch current gold price, using fallback",
        variant: "destructive",
      });

      const fallback24K = 7200;
      const fallbackData: GoldPriceData = {
        priceInrPerGram24K: fallback24K,
        priceInrPerGram22K: (22 / 24) * fallback24K,
        lastUpdated: new Date().toISOString(),
        source: "fallback",
        error: err?.message || "API unavailable",
      };
      setPriceData(fallbackData);
      onPriceUpdate(computeBreakdown(fallback24K).total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldPrice();
    const interval = setInterval(fetchGoldPrice, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayPrice = priceData ? resolveBasePrice(priceData, purity) : null;
  const breakdown = displayPrice ? computeBreakdown(displayPrice) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            Gold Price (INR / gram)
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md overflow-hidden border bg-surface">
              <button
                className={`px-2 py-1 text-xs font-medium ${
                  purity === 24 ? "bg-primary text-white" : "bg-transparent text-muted-foreground"
                }`}
                onClick={() => setPurity(24)}
                disabled={loading}
              >
                24K
              </button>
              <button
                className={`px-2 py-1 text-xs font-medium ${
                  purity === 22 ? "bg-primary text-white" : "bg-transparent text-muted-foreground"
                }`}
                onClick={() => setPurity(22)}
                disabled={loading}
              >
                22K
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchGoldPrice} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="flex flex-col sm:flex-row gap-1 sm:justify-between">
          <div>
            Live market rates • Last updated:{" "}
            {priceData ? (
              new Date(priceData.lastUpdated).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })
            ) : "Loading..."}
          </div>
          <Badge variant={priceData?.source === "fallback" ? "secondary" : "default"}>
            {priceData?.source === "fallback" ? "Estimated" : "Live"}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && !priceData ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted rounded w-32"></div>
            <div className="h-4 bg-muted rounded w-24"></div>
          </div>
        ) : breakdown && (
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold text-yellow-600">
                ₹{breakdown.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-sm text-muted-foreground">
                per gram ({purity}K) including 6% import duty + 1.5% local charges
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-xs">
                <div className="font-medium">Base Price:</div>
                <div>₹{breakdown.base.toFixed(2)}</div>
              </div>
              <div className="text-xs">
                <div className="font-medium">Import Duty (6%):</div>
                <div>₹{breakdown.importDuty.toFixed(2)}</div>
              </div>
              <div className="text-xs">
                <div className="font-medium">Local Charges (1.5%):</div>
                <div>₹{breakdown.localCharges.toFixed(2)}</div>
              </div>
              <div className="text-xs">
                <div className="font-medium">Total:</div>
                <div>₹{breakdown.total.toFixed(2)}</div>
              </div>
            </div>

            {priceData?.error && (
              <div className="text-xs text-amber-600">{priceData.error}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};