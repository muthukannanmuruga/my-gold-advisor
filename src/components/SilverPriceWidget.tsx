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

interface SilverApiResponse {
  price_gram_24k?: number;
  price?: number;
}

interface SilverPriceData {
  priceInrPerGram: number;
  lastUpdated: string;
  source: string;
  error?: string;
}

interface SilverPriceWidgetProps {
  onPriceUpdate: (price: number) => void;
}

const SILVERAPI_URL = "https://www.goldapi.io/api/XAG/INR";
const GOLDAPI_KEYS = [
  "goldapi-1424smdvlf2mb-io",
  "goldapi-3e0c1smdzgsi9r-io",
  "goldapi-3e0c1smdzgv381-io",
  "goldapi-3e0c1smdzgwsdi-io",
  "goldapi-bjf1f9sme3wjm5d-io",
  "goldapi-bjf1f9sme42prdt-io",
  "goldapi-1cey8cmsme52xgpr-io",
  "goldapi-1amhsme530vnf-io",
  "goldapi-1amhsme534dyb-io",
];

const IMPORT_DUTY_RATE = 0.15;
const LOCAL_CHARGES_RATE = 0.05;
const KEY_INDEX_STORAGE_KEY = "silverapi_key_index";

export const SilverPriceWidget = ({ onPriceUpdate }: SilverPriceWidgetProps) => {
  const [priceData, setPriceData] = useState<SilverPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [currentKeyIndex, setCurrentKeyIndex] = useState<number>(() => {
    const saved = localStorage.getItem(KEY_INDEX_STORAGE_KEY);
    return saved ? Number(saved) : 0;
  });
  const { toast } = useToast();

  const computeBreakdown = (base: number) => ({
    base,
    importDuty: base * IMPORT_DUTY_RATE,
    localCharges: base * LOCAL_CHARGES_RATE,
    total: base * (1 + IMPORT_DUTY_RATE + LOCAL_CHARGES_RATE),
  });

  const tryApiKey = async (keyIndex: number): Promise<SilverPriceData> => {
    const resp = await fetch(SILVERAPI_URL, {
      headers: {
        "x-access-token": GOLDAPI_KEYS[keyIndex],
        Accept: "application/json",
      },
    });

    if (!resp.ok) throw new Error(`GoldAPI HTTP ${resp.status}`);
    const json: SilverApiResponse = await resp.json();

    const price = json.price_gram_24k ?? (json.price ? json.price / 31.1035 : null);
    if (!price) throw new Error("Incomplete silver price data");

    return {
      priceInrPerGram: Number(price.toFixed(2)),
      lastUpdated: new Date().toISOString(),
      source: "GoldAPI XAG/INR endpoint",
    };
  };

  const fetchSilverPrice = async () => {
    setLoading(true);
    let data: SilverPriceData | null = null;

    for (let i = 0; i < GOLDAPI_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % GOLDAPI_KEYS.length;
      try {
        data = await tryApiKey(keyIndex);
        setCurrentKeyIndex(keyIndex);
        localStorage.setItem(KEY_INDEX_STORAGE_KEY, String(keyIndex));
        break;
      } catch (err: any) {
        console.warn(`Silver API key ${keyIndex} failed:`, err?.message);
        data = null;
      }
    }

    if (data) {
      const { data: prevData } = await supabase.rpc("get_yesterday_last_silver_price");
      if (prevData && prevData.length > 0) {
        const yesterdayPrice = Number(prevData[0].price_inr_per_gram);
        setPreviousPrice(isNaN(yesterdayPrice) ? null : yesterdayPrice);
      }

      setPriceData(data);

      await supabase.from("silver_price_history").insert({
        price_inr_per_gram: data.priceInrPerGram,
        source: data.source,
      });

      onPriceUpdate(computeBreakdown(data.priceInrPerGram).total);
    } else {
      toast({
        title: "Error",
        description: "All API keys failed. Using fallback price.",
        variant: "destructive",
      });

      const fallback = 95;
      setPriceData({
        priceInrPerGram: fallback,
        lastUpdated: new Date().toISOString(),
        source: "fallback",
        error: "All API keys exhausted",
      });
      onPriceUpdate(computeBreakdown(fallback).total);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSilverPrice();
    const interval = setInterval(fetchSilverPrice, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const breakdown = priceData ? computeBreakdown(priceData.priceInrPerGram) : null;

  const priceChange =
    previousPrice && priceData ? priceData.priceInrPerGram - previousPrice : null;
  const priceChangePercent =
    previousPrice && priceChange !== null ? (priceChange / previousPrice) * 100 : null;

  const isNoChange = priceChange !== null ? Math.abs(priceChange) < 0.005 : false;
  const priceUp = priceChange !== null && priceChange > 0 && !isNoChange;
  const priceDown = priceChange !== null && priceChange < 0 && !isNoChange;

  const displayChange = priceChange !== null ? (isNoChange ? 0 : priceChange) : null;
  const displayChangePercent =
    priceChangePercent !== null ? (isNoChange ? 0 : priceChangePercent) : null;

  const mainPriceColorClass = priceUp
    ? "text-green-600"
    : priceDown
    ? "text-red-600"
    : isNoChange
    ? "text-black"
    : "text-slate-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-400" />
            Silver Price (INR / gram)
          </div>
          <Button variant="ghost" size="sm" onClick={fetchSilverPrice} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription className="flex flex-col sm:flex-row gap-1 sm:justify-between">
          <div>
            Live market rates • Last updated:{" "}
            {priceData
              ? new Date(priceData.lastUpdated).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })
              : "Loading..."}
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
        ) : (
          breakdown && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`text-3xl font-bold ${mainPriceColorClass}`}>
                  ₹
                  {breakdown.total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                {priceChange !== null && (
                  <div
                    className={`flex items-center text-sm font-medium ${
                      priceUp ? "text-green-600" : priceDown ? "text-red-600" : "text-black"
                    }`}
                  >
                    {priceUp && <ArrowUpRight className="w-4 h-4 mr-1" />}
                    {priceDown && <ArrowDownRight className="w-4 h-4 mr-1" />}
                    ₹{Math.abs(displayChange || 0).toFixed(2)} (
                    {Math.abs(displayChangePercent || 0).toFixed(2)}%)
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                per gram (pure silver) including 15% import duty + 5% local charges
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-xs">
                  <div className="font-medium">Base Price:</div>
                  <div>₹{breakdown.base.toFixed(2)}</div>
                </div>
                <div className="text-xs">
                  <div className="font-medium">Import Duty (15%):</div>
                  <div>₹{breakdown.importDuty.toFixed(2)}</div>
                </div>
                <div className="text-xs">
                  <div className="font-medium">Local Charges (5%):</div>
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
          )
        )}
      </CardContent>
    </Card>
  );
};
