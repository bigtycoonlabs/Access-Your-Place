import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MarketSearchResult {
  id: string;
  market: string;
  category: string;
  summary: string;
  score: number;
  createdAt: string;
}

export default function LeadForge() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("25");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<MarketSearchResult[]>([]);

  const runMarketScan = async () => {
    if (!/^\d{5}$/.test(zip)) {
      setMessage("Enter a valid 5-digit zip code.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("apollo-leadforge", {
        body: {
          prompt: `Create a short leasing market summary for Access Your Place around zip ${zip} within ${radius} miles. Return JSON only: {"market":"...","category":"...","summary":"...","score":75}`,
          maxTokens: 1000,
        },
      });

      if (error || data?.error) throw new Error(error?.message || data?.error || "Market scan failed");

      const text = typeof data?.text === "string" ? data.text : "";
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;

      setResults(prev => [{
        id: `${zip}-${Date.now()}`,
        market: parsed?.market || zip,
        category: parsed?.category || "Leasing Market",
        summary: parsed?.summary || "Market scan completed.",
        score: Number(parsed?.score || 70),
        createdAt: new Date().toISOString(),
      }, ...prev]);
    } catch (err: any) {
      setMessage(err?.message || "LeadForge is installed, but the Apollo function is not ready yet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-5">
        <Card className="border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">LeadForge</CardTitle>
                <CardDescription className="text-slate-400">
                  Back-office leasing market scanner for Access Your Place staff.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-900 text-emerald-100">Installed</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
              <div className="space-y-2">
                <Label htmlFor="leadforge-zip" className="text-slate-300">Zip code</Label>
                <Input
                  id="leadforge-zip"
                  value={zip}
                  maxLength={5}
                  onChange={e => setZip(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && runMarketScan()}
                  placeholder="78201"
                  className="border-slate-700 bg-slate-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadforge-radius" className="text-slate-300">Radius</Label>
                <select
                  id="leadforge-radius"
                  value={radius}
                  onChange={e => setRadius(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                >
                  {["10", "25", "50", "100"].map(value => <option key={value} value={value}>{value} miles</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={runMarketScan} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                  {loading ? "Scanning…" : "Run Scan"}
                </Button>
              </div>
            </div>
            {message && <div className="mt-4 rounded-md border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-100">{message}</div>}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="text-base">Pipeline Status</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{results.length}</p><p className="text-sm text-slate-400">Market scans saved this session</p></CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="text-base">Integration</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-300">Uses Supabase Edge Function: <code>apollo-leadforge</code></p></CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="text-base">Access</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-300">Available from the staff back office only.</p></CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader><CardTitle>Recent scans</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No scans yet.</p>
            ) : (
              <div className="space-y-3">
                {results.map(result => (
                  <div key={result.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{result.market}</p>
                        <p className="text-xs text-slate-500">{result.category}</p>
                      </div>
                      <Badge className="bg-blue-900 text-blue-100">Score {result.score}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{result.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
