"use client";
/* eslint-disable  @typescript-eslint/no-explicit-any */

import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BsClipboardDataFill } from "react-icons/bs";
import { BarChart as BarChartIcon, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const GREEN = "#63df4e";
const CARD_BG = "#073561";

const fmtNum = (n: number) => n.toLocaleString();
const ellipsize = (s: string, max = 28) => (s?.length > max ? s.slice(0, max - 1) + "…" : s);

const ChartTooltip = ({ active, label, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/15 bg-[#0d4579] p-2 text-white shadow-sm">
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-sm leading-5">
          {p.name || p.dataKey}: <span className="font-semibold" style={{ color: GREEN }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AcceleratorDashboard() {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedThemeIdx, setSelectedThemeIdx] = React.useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        const res = await fetch(`${baseUrl}/report`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Try prompting our agent first!");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-white" style={{ backgroundColor: CARD_BG }}>
        <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10">
          <CardHeader><CardTitle>Loading report…</CardTitle></CardHeader>
          <CardContent className="text-sm text-white/70">Fetching /report</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-white" style={{ backgroundColor: CARD_BG }}>
        <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10">
          <CardHeader><CardTitle>Try prompting our agent first!</CardTitle></CardHeader>
          <CardContent className="text-sm text-red-400">{error ?? "No data returned"}</CardContent>
        </Card>
      </div>
    );
  }

  // Leaderboard
  const hits = (data.leaderboards?.by_hits ?? [])
    .slice(0, 10)
    .map((d: any) => ({
      ...d,
      title_short: d.accelerator_title.replace("Jumpstart Your ", "JS: ").replace("TuneUp Your ", "TU: "),
    }));

  // Themes
  const themes = (data.recommendations?.top_uncovered_themes ?? []).slice(0, 10);
  const themeSeries = themes.map((t: any) => ({ theme: t.theme, demand: t.demand }));
  const sel = themes[Math.min(selectedThemeIdx, Math.max(0, themes.length - 1))] ?? {
    top_related_tokens: [],
    sample_requests: [],
  };

  // Token overlap
  const overlap = data.token_stats ?? { req_token_count: 0, accel_token_count: 0, overlap_token_count: 0, jaccard_overlap: 0 };
  const overlapSeries = [
    { name: "Requests", v: overlap.req_token_count },
    { name: "Accelerators", v: overlap.accel_token_count },
    { name: "Overlap", v: overlap.overlap_token_count },
  ];

  return (
    <div className="min-h-screen text-white mx-auto max-w-7xl space-y-6 p-4 md:p-8" style={{ backgroundColor: CARD_BG }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <BsClipboardDataFill />
        <h1 className="text-lg font-semibold">Accelerator Data</h1>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={<BarChartIcon className="h-4 w-4" style={{ color: GREEN }} />} title="Accelerators" value={fmtNum(data.summary.accelerator_count)} />
        <StatCard icon={<Activity className="h-4 w-4" style={{ color: GREEN }} />} title="User Requests" value={fmtNum(data.summary.user_request_count)} />

        {/* Token Insights */}
        <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Token Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="gaps">
              <TabsList className="w-full flex flex-wrap justify-start gap-2 bg-[#0b4072] text-white rounded-md p-1">
                <TabsTrigger value="gaps" className="flex-1 min-w-[100px] text-white data-[state=active]:bg-transparent data-[state=active]:text-[#63df4e] data-[state=active]:border-b-2 data-[state=active]:border-[#63df4e] transition-colors">Top Gap Tokens</TabsTrigger>
                <TabsTrigger value="reqOnly" className="flex-1 min-w-[100px] text-white data-[state=active]:bg-transparent data-[state=active]:text-[#63df4e] data-[state=active]:border-b-2 data-[state=active]:border-[#63df4e] transition-colors">Req Tokens</TabsTrigger>
                <TabsTrigger value="accelOnly" className="flex-1 min-w-[100px] text-white data-[state=active]:bg-transparent data-[state=active]:text-[#63df4e] data-[state=active]:border-b-2 data-[state=active]:border-[#63df4e] transition-colors">Accel Tokens</TabsTrigger>
              </TabsList>
              <TabsContent value="gaps" className="mt-4"><TokenList items={data.token_stats.top_gap_topics} /></TabsContent>
              <TabsContent value="reqOnly" className="mt-4"><TokenList items={data.token_stats.sample_req_only_tokens} /></TabsContent>
              <TabsContent value="accelOnly" className="mt-4"><TokenList items={data.token_stats.sample_accel_only_tokens} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards & Uncovered Themes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Top Accelerators by Hits">
          <BarChart data={hits} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
            <XAxis type="number" stroke="#fff" />
            <YAxis type="category" dataKey="title_short" width={240} stroke="#fff" tickFormatter={(v) => ellipsize(String(v))} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="hits" name="Hits" fill={GREEN} radius={[8, 8, 8, 8]} background={{ fill: "rgba(255,255,255,0.06)" }}>
              <LabelList dataKey="hits" position="right" />
            </Bar>
          </BarChart>
        </ChartCard>

        {/* FIXED: cleaner Uncovered Themes card layout */}
        <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10 min-h-[420px]">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Top Requested but Uncovered Themes</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]">
            {themeSeries.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-white/70">
                No uncovered themes at current settings.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full">
                {/* LEFT: chart */}
                <div className="lg:col-span-3">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={themeSeries}
                      layout="vertical"
                      margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                      onClick={(e: any) => {
                        const key = e?.activePayload?.[0]?.payload?.theme;
                        if (!key) return;
                        const idx = themeSeries.findIndex((x: any) => x.theme === key);
                        if (idx >= 0) setSelectedThemeIdx(idx);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                      <XAxis type="number" stroke="#fff" />
                      <YAxis type="category" dataKey="theme" width={220} stroke="#fff" tickFormatter={(v) => ellipsize(String(v), 24)} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="demand" name="Requests" fill={GREEN} radius={[10, 10, 10, 10]} background={{ fill: "rgba(255,255,255,0.06)" }}>
                        <LabelList dataKey="demand" position="right" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* RIGHT: details (fixed height + scroll) */}
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <div className="text-sm text-white/80 mb-2">Related Tokens</div>
                  <div className="mb-4">
                    <TokenList items={sel.top_related_tokens ?? []} />
                  </div>

                  <div className="text-sm text-white/80 mb-2">Sample Requests</div>
                  <ul className="list-disc list-inside space-y-2 text-white/90 text-sm overflow-y-auto pr-1"
                      style={{ maxHeight: 180, wordBreak: "break-word", whiteSpace: "normal" }}>
                    {(sel.sample_requests ?? []).map((s: string, i: number) => (
                      <li key={i} className="opacity-90">{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token Overlap */}
      <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10">
        <CardHeader><CardTitle className="text-base">Token Overlap</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={overlapSeries} margin={{ left: 16, right: 16, top: 20, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
              <XAxis dataKey="name" stroke="#fff" />
              <YAxis allowDecimals={false} stroke="#fff" />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="v" name="Tokens" fill={GREEN} radius={[8, 8, 8, 8]} background={{ fill: "rgba(255,255,255,0.06)" }}>
                <LabelList dataKey="v" position="top" fill="#fff" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function StatCard({
  icon, title, value, extra,
}: { icon: React.ReactNode; title: string; value: string; extra?: string }) {
  return (
    <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-white/10">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" style={{ color: GREEN }}>{value}</div>
        {extra && <div className="text-xs text-white/70 mt-1">{extra}</div>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ backgroundColor: CARD_BG }} className="text-white border border-white/10 h-[420px]">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TokenList({ items }: { items: string[] }) {
  if (!items?.length) {
    return <div className="text-sm text-white/60">No items</div>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <Badge
          key={i}
          variant="secondary"
          className="text-xs border"
          style={{ backgroundColor: "rgba(99, 223, 78, 0.15)", color: GREEN, borderColor: "rgba(99, 223, 78, 0.3)" }}
        >
          {t}
        </Badge>
      ))}
    </div>
  );
}
