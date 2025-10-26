"use client";
/* eslint-disable  @typescript-eslint/no-explicit-any */

import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BsClipboardDataFill } from "react-icons/bs";
import { Info, Gauge, BarChart as BarChartIcon, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtNum = (n: number) => n.toLocaleString();

const ChartTooltip = ({ active, label, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-[#0d4579] p-2 text-white shadow-sm">
      <div className="text-xs font-medium opacity-70">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-sm">
          {p.name || p.dataKey}:{" "}
          <span className="font-semibold text-[#63df4e]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AcceleratorDashboard() {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:8000/report", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-white bg-[#073561]">
        <Card className="bg-black/30 text-white">
          <CardHeader>
            <CardTitle>Loading report…</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70">
            Fetching /report
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-white bg-[#073561]">
        <Card className="bg-black/30 text-white">
          <CardHeader>
            <CardTitle>Failed to load</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-400">
            {error ?? "No data returned"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hits = (data.leaderboards?.by_hits ?? [])
    .slice(0, 10)
    .map((d: any) => ({
      ...d,
      title_short: d.accelerator_title
        .replace("Jumpstart Your ", "JS: ")
        .replace("TuneUp Your ", "TU: "),
    }));

  const sims = (data.leaderboards?.by_mean_similarity ?? [])
    .slice(0, 10)
    .map((d: any) => ({ ...d, pct: +(d.mean_similarity * 100).toFixed(2) }));

  const simStats =
    data.similarity_stats ?? {
      mean_best_similarity: 0,
      median_best_similarity: 0,
      p90_best_similarity: 0,
      min_best_similarity: 0,
      max_best_similarity: 0,
      threshold: 0.15,
    };

  const simSeries = [
    { name: "Min", v: simStats.min_best_similarity },
    { name: "Median", v: simStats.median_best_similarity },
    { name: "Mean", v: simStats.mean_best_similarity },
    { name: "P90", v: simStats.p90_best_similarity },
    { name: "Max", v: simStats.max_best_similarity },
  ].map((d) => ({ ...d, pct: +(d.v * 100).toFixed(2) }));

  const overlap =
    data.token_stats ?? {
      req_token_count: 0,
      accel_token_count: 0,
      overlap_token_count: 0,
      jaccard_overlap: 0,
    };

  const overlapSeries = [
    { name: "Requests", v: overlap.req_token_count },
    { name: "Accelerators", v: overlap.accel_token_count },
    { name: "Overlap", v: overlap.overlap_token_count },
  ];

  return (
    <div className="min-h-screen bg-[#073561] text-white mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <div className="flex items-center gap-3">
      <BsClipboardDataFill />
      <h1 className="text-lg font-semibold">Accelerator Data</h1>
    </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={<BarChartIcon className="h-4 w-4 text-[#63df4e]" />}
          title="Accelerators"
          value={fmtNum(data.summary.accelerator_count)}
        />
        <StatCard
          icon={<Activity className="h-4 w-4 text-[#63df4e]" />}
          title="User Requests"
          value={fmtNum(data.summary.user_request_count)}
        />
        <StatCard
          icon={<Gauge className="h-4 w-4 text-[#63df4e]" />}
          title="Coverage"
          value={fmtPct(data.coverage.coverage_rate)}
          extra={`${fmtNum(data.coverage.covered_requests)} / ${fmtNum(
            data.summary.user_request_count
          )}`}
        />
        <StatCard
          icon={<Info className="h-4 w-4 text-[#63df4e]" />}
          title="Embedding Dim"
          value={fmtNum(data.summary.embedding_dim)}
        />
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Top Accelerators by Hits">
          <BarChart
            data={hits}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
            <XAxis type="number" stroke="#fff" />
            <YAxis type="category" dataKey="title_short" width={220} stroke="#fff" />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="hits" name="Hits" fill="#63df4e">
              <LabelList dataKey="hits" position="right" />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Leaderboards by Mean Similarity">
          <BarChart
            data={sims}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#fff"
            />
            <YAxis
              type="category"
              dataKey="accelerator_title"
              width={260}
              stroke="#fff"
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              x={(data?.similarity_stats?.threshold ?? 0.15) * 100}
              stroke="#63df4e"
              strokeDasharray="4 4"
            />
            <Bar dataKey="pct" name="Mean Similarity (%)" fill="#63df4e">
                <LabelList
                dataKey="pct"
                position="right"
                formatter={(value: any) => {
                    const num = typeof value === "object" ? value?.pct ?? value?.value ?? 0 : value;
                    return `${Number(num).toFixed(1)}%`;
                }}
                />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      {/* Distribution & Tokens */}
      <Card className="bg-black/25 text-white border border-white/10">
        <CardHeader>
          <CardTitle className="text-base">
            Similarity Distribution & Token Overlap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={simSeries} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                <XAxis dataKey="name" stroke="#fff" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#fff" />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  y={(data?.similarity_stats?.threshold ?? 0.15) * 100}
                  stroke="#63df4e"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  name="Best Similarity (%)"
                  stroke="#63df4e"
                  dot={{ r: 3, fill: "#63df4e" }}
                />
              </LineChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={overlapSeries} margin={{ left: 16, right: 16, top: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                <XAxis dataKey="name" stroke="#fff" />
                <YAxis allowDecimals={false} stroke="#fff" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="v" name="Tokens" fill="#63df4e">
                  <LabelList dataKey="v" position="top" fill="#fff" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Separator className="my-6 bg-white/20" />

            <Tabs defaultValue="gaps">
            <TabsList className="bg-[#0b4072] text-white">
                <TabsTrigger
                value="gaps"
                className="text-white data-[state=active]:text-[#63df4e] data-[state=active]:border-b-2 data-[state=active]:border-[#63df4e] transition-colors"
                >
                Top Gap Topics
                </TabsTrigger>
                <TabsTrigger
                value="reqOnly"
                className="text-white data-[state=active]:text-[#63df4e] data-[state=active]:border-b-2 data-[state=active]:border-[#63df4e] transition-colors"
                >
                Req-Only Tokens
                </TabsTrigger>
                <TabsTrigger
                value="accelOnly"
                className="text-white data-[state=active]:text-[#63df4e] data-[state=active]:border-b-2 data-[state=active]:border-[#63df4e] transition-colors"
                >
                Accel-Only Tokens
                </TabsTrigger>
            </TabsList>
            <TabsContent value="gaps" className="mt-4">
                <TokenList items={data.token_stats.top_gap_topics} />
            </TabsContent>
            <TabsContent value="reqOnly" className="mt-4">
                <TokenList items={data.token_stats.sample_req_only_tokens} />
            </TabsContent>
            <TabsContent value="accelOnly" className="mt-4">
                <TokenList items={data.token_stats.sample_accel_only_tokens} />
            </TabsContent>
            </Tabs>
        </CardContent>
      </Card>

      <div className="text-xs text-white/60">
        Generated at:{" "}
        {new Date(data.generated_at ?? new Date().toISOString()).toLocaleString()}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  extra?: string;
}) {
  return (
    <Card className="bg-black/25 text-white border border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-[#63df4e]">{value}</div>
        {extra && <div className="text-xs text-white/70 mt-1">{extra}</div>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-black/25 text-white border border-white/10 h-[420px]">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TokenList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <Badge
          key={i}
          variant="secondary"
          className="text-xs bg-[#63df4e]/20 text-[#63df4e] border border-[#63df4e]/30"
        >
          {t}
        </Badge>
      ))}
    </div>
  );
}
