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
import { RefreshCw, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useToast } from "./ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GoldApiResponse {
  price_gram_24k?: number;
  price_gram_22k?: number;
  price?: number;
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
const GOLDAPI_KEYS = [
  "goldapi-1424smdvlf2mb-io",
  "goldapi-3e0c1smdzgsi9r-io",
  "goldapi-3e0c1smdzgv381-io",
  "goldapi-3e0c1smdzgwsdi-io",
  "goldapi-bjf1f9sme3wjm5d-io",
];

const IMPORT_DUTY_RATE = 0.06;
const LOCAL_CHARGES_RATE = 0.015;
const KEY_INDEX_STORAGE_KEY = "goldapi_key_index";

export const GoldPriceWidget = ({ onPriceUpdate }: GoldPriceWidgetProps) => {
  const [priceData, setPriceData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purity, setPurity] = useState<Purity>(22);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [currentKeyIndex, setCurrentKeyIndex] = useState<number>(() => {
    const savedIndex = localStorage.getItem(KEY_INDEX_STORAGE_KEY);
    return savedIndex ? Number(savedIndex) : 0;
  });
  const { toast } = useToast();

  const resolveBasePrice = (data: GoldPriceData, purity: Purity) =>
    purity === 24 ? data.priceInrPerGram24K : data.priceInrPerGram22K;

  const computeBreakdown = (base: number) => ({
    base,
    importDuty: base * IMPORT_DUTY_RATE,
    localCharges: base * LOCAL_CHARGES_RATE,
    total: base * (1 + IMPORT_DUTY_RATE + LOCAL_CHARGES_RATE),
  });

  const tryApiKey = async (keyIndex: number): Promise<GoldPriceData> => {
    const resp = await fetch(GOLDAPI_URL, {
      headers: {
        "x-access-token": GOLDAPI_KEYS[keyIndex],
        Accept: "application/json",
      },
    });

    if (!resp.ok) throw new Error(`GoldAPI HTTP ${resp.status}`);
    const json: GoldApiResponse = await resp.json();

    let price24K = json.price_gram_24k ?? (json.price ? json.price / 31.1035 : null);
    let price22K = json.price_gram_22k ?? (price24K ? (22 / 24) * price24K : null);

    if (!price24K || !price22K) throw new Error("Incomplete gold price data");

    return {
      priceInrPerGram24K: Number((price24K || 0).toFixed(2)),
      priceInrPerGram22K: Number((price22K || 0).toFixed(2)),
      lastUpdated: new Date().toISOString(),
      source: "GoldAPI INR endpoint",
    };
  };

  const fetchGoldPrice = async () => {
    setLoading(true);
    let data: GoldPriceData | null = null;
    let isApiSuccess = false;

    for (let i = 0; i < GOLDAPI_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % GOLDAPI_KEYS.length;
      try {
        data = await tryApiKey(keyIndex);
        setCurrentKeyIndex(keyIndex);
        localStorage.setItem(KEY_INDEX_STORAGE_KEY, String(keyIndex));
        isApiSuccess = true;
        break;
      } catch (err: any) {
        console.warn(`API key ${keyIndex} failed:`, err.message);
      }
    }

    if (isApiSuccess && data) {
      const { data: prevData } = await supabase.rpc('get_yesterday_last_price');

      if (prevData && prevData.length > 0) {
        const yesterdayPrice = Number(prevData[0].price_inr_per_gram);
        setPreviousPrice(isNaN(yesterdayPrice) ? null : yesterdayPrice);
      }

      setPriceData(data);

      await supabase.from("gold_price_history").insert({
        price_inr_per_gram: data.priceInrPerGram24K,
        price_inr_per_gram_22k: data.priceInrPerGram22K,
        source: data.source,
      });

      onPriceUpdate(computeBreakdown(data.priceInrPerGram24K).total);
    } else {
      toast({
        title: "Error",
        description: "All API keys failed. Using fallback price.",
        variant: "destructive",
      });

      const fallback24K = 7200;
      const fallbackData: GoldPriceData = {
        priceInrPerGram24K: fallback24K,
        priceInrPerGram22K: (22 / 24) * fallback24K,
        lastUpdated: new Date().toISOString(),
        source: "fallback",
        error: "All API keys exhausted",
      };

      setPriceData(fallbackData);
      onPriceUpdate(computeBreakdown(fallback24K).total);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchGoldPrice();
    const interval = setInterval(fetchGoldPrice, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayPrice = priceData ? resolveBasePrice(priceData, purity) : null;
  const breakdown = displayPrice ? computeBreakdown(displayPrice) : null;

  const priceChange = previousPrice && priceData
    ? priceData.priceInrPerGram24K - previousPrice
    : null;

  const priceChangePercent = previousPrice && priceData
    ? (priceChange! / previousPrice) * 100
    : null;

  // New no-change detection
  const isNoChange = priceChange !== null ? Math.abs(priceChange) < 0.005 : false;
  const priceUp = priceChange !== null && priceChange > 0 && !isNoChange;
  const priceDown = priceChange !== null && priceChange < 0 && !isNoChange;

  const displayChange = priceChange !== null ? (isNoChange ? 0 : priceChange) : null;
  const displayChangePercent = priceChangePercent !== null
    ? (isNoChange ? 0 : priceChangePercent)
    : null;

  const mainPriceColorClass =
    priceUp ? "text-green-600"
    : priceDown ? "text-red-600"
    : isNoChange ? "text-black"
    : "text-yellow-600";

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
              {[24, 22].map((k) => (
                <button
                  key={k}
                  className={`px-2 py-1 text-xs font-medium ${
                    purity === k ? "bg-primary text-white" : "bg-transparent text-muted-foreground"
                  }`}
                  onClick={() => setPurity(k as Purity)}
                  disabled={loading}
                >
                  {k}K
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchGoldPrice} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="flex flex-col sm:flex-row gap-1 sm:justify-between">
          <div>
            Live market rates • Last updated: {priceData ? new Date(priceData.lastUpdated).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
            }) : "Loading..."}
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
            <div className="flex items-center gap-2">
              <div className={`text-3xl font-bold ${mainPriceColorClass}`}>
                ₹{breakdown.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              {priceChange !== null && (
                <div
                  className={`flex items-center text-sm font-medium ${
                    priceUp ? "text-green-600"
                    : priceDown ? "text-red-600"
                    : "text-black"
                  }`}
                >
                  {priceUp && <ArrowUpRight className="w-4 h-4 mr-1" />}
                  {priceDown && <ArrowDownRight className="w-4 h-4 mr-1" />}
                  ₹{Math.abs(displayChange || 0).toFixed(2)} ({Math.abs(displayChangePercent || 0).toFixed(2)}%)
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              per gram ({purity}K) including 6% import duty + 1.5% local charges
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
