import { useCallback, useState } from "react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const ScanSchema = z.object({
  market: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(1200),
  score: z.coerce.number().int().min(0).max(100),
});

interface MarketSearchResult extends z.infer<typeof ScanSchema> {
  id: string;
  createdAt: string;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("LeadForge returned malformed market data.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

export default function LeadForge() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("25");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<MarketSearchResult[]>([]);

  const runMarketScan = useCallback(async () => {
    if (loading) return;
    if (!/^\d{5}$/.test(zip)) {
      setMessage("Enter a valid 5-digit ZIP code.");
      return;
    }

    const radiusNumber = Number(radius);
    if (![10, 25, 50, 100].includes(radiusNumber)) {
      setMessage("Select a supported search radius.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session) {
        throw new Error("Your secure session has expired. Sign in again before running LeadForge.");
      }

      const { data, error } = await supabase.functions.invoke("apollo-leadforge", {
        body: { zip, radius: radiusNumber },
      });

      if (error) throw new Error("LeadForge could not complete the scan. Please retry.");
      if (!data || typeof data !== "object") throw new Error("LeadForge returned no usable data.");
      if (typeof data.error === "string" && data.error.trim()) throw new Error(data.error);
      if (typeof data.text !== "string" || !data.text.trim()) throw new Error("LeadForge returned an empty result.");

      const parsed = ScanSchema.safeParse(extractJsonObject(data.text));
      if (!parsed.success) throw new Error("LeadForge returned market data in an unexpected format.");

      const nextResult: MarketSearchResult = {
        id: crypto.randomUUID(),
        ...parsed.data,
        createdAt: new Date().toISOString(),
      };

      setResults((previous) => [nextResult, ...previous].slice(0, 25));
      setMessage("Market scan completed securely.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "LeadForge request failed.";
      setMessage(text);
    } finally {
      setLoading(false);
    }
  }, [loading, radius, zip]);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-5">
        <Card className="border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">LeadForge</CardTitle>
                <CardDescription className="text-slate-400">
                  Secure back-office leasing market scanner for Access Your Place staff.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-900 text-emerald-100">Protected</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
              <div className="space-y-2">
                <Label htmlFor="leadforge-zip" className="text-slate-300">ZIP code</Label>
                <Input
                  id="leadforge-zip"
                  value={zip}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  aria-invalid={Boolean(zip) && !/^\d{5}$/.test(zip)}
                  onChange={(event) => setZip(event.target.value.replace(/\D/g, "").slice(0, 5))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void runMarketScan();
                    }
                  }}
                  placeholder="78201"
                  className="border-slate-700 bg-slate-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadforge-radius" className="text-slate-300">Radius</Label>
                <select
                  id="leadforge-radius"
                  value={radius}
                  disabled={loading}
                  onChange={(event) => setRadius(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white disabled:opacity-60"
                >
                  {["10", "25", "50", "100"].map((value) => <option key={value} value={value}>{value} miles</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => void runMarketScan()} disabled={loading || zip.length !== 5} className="w-full bg-blue-600 hover:bg-blue-700">
                  {loading ? "Scanning…" : "Run Scan"}
                </Button>
              </div>
            </div>
            {message && (
              <div role="status" aria-live="polite" className="mt-4 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="text-base">Pipeline Status</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{results.length}</p><p className="text-sm text-slate-400">Validated scans saved this session</p></CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="text-base">Integration</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-300">Authenticated Supabase Edge Function: <code>apollo-leadforge</code></p></CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="text-base">Access</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-300">Requires an active Supabase authentication session.</p></CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader><CardTitle>Recent scans</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No scans yet.</p>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <div key={result.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{result.market}</p>
                        <p className="text-xs text-slate-500">{result.category} · {new Date(result.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge className="bg-blue-900 text-blue-100">Score {result.score}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{result.summary}</p>
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
