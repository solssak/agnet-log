import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { formatTokens } from "../utils/format";

type DailyStats = {
  date: string;
  input_tokens: number;
  output_tokens: number;
  session_count: number;
  message_count: number;
};

type HourlyActivity = {
  hour: number;
  day: number;
  count: number;
};

type ProjectStats = {
  name: string;
  path: string;
  total_input_tokens: number;
  total_output_tokens: number;
  session_count: number;
};

type DashboardStats = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_sessions: number;
  total_messages: number;
  daily_stats: DailyStats[];
  hourly_activity: HourlyActivity[];
  project_stats: ProjectStats[];
  estimated_cost: number;
  avg_session_minutes: number;
};

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const result = await invoke<DashboardStats>("get_dashboard_stats");
      setStats(result);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-center items-center h-64 text-zinc-500">
          Loading statistics...
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-center items-center h-64 text-zinc-500">
          Failed to load statistics
        </div>
      </div>
    );
  }

  const heatmapData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const activity = stats.hourly_activity.find(
        (a) => a.day === day && a.hour === hour,
      );
      return activity?.count || 0;
    }),
  );

  const maxActivity = Math.max(...stats.hourly_activity.map((a) => a.count), 1);

  const chartData = stats.daily_stats.slice(-30).map((d) => ({
    date: d.date.slice(5),
    input: d.input_tokens,
    output: d.output_tokens,
    total: d.input_tokens + d.output_tokens,
  }));

  const maxTotal = Math.max(...chartData.map((x) => x.total), 1);

  const peakDayIndex = chartData.reduce(
    (max, d, i) => (d.total > (chartData[max]?.total || 0) ? i : max),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-500 tracking-wide mb-3">
            Tokens
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm text-zinc-500">↓</span>
            <span className="text-xl font-bold">
              {formatTokens(stats.total_input_tokens)}
            </span>
            <span className="text-sm text-zinc-500">input</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-zinc-500">↑</span>
            <span className="text-xl font-bold">
              {formatTokens(stats.total_output_tokens)}
            </span>
            <span className="text-sm text-zinc-500">output</span>
          </div>
        </div>
        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-500 tracking-wide mb-3">
            Activity
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-bold">
              {stats.total_sessions.toLocaleString()}
            </span>
            <span className="text-sm text-zinc-500">sessions</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-bold">
              {stats.total_messages.toLocaleString()}
            </span>
            <span className="text-sm text-zinc-500">messages</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">
              {formatDuration(stats.avg_session_minutes)}
            </span>
            <span className="text-sm text-zinc-500">avg time</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-6 text-center text-white shadow-lg">
        <div className="text-4xl font-bold mb-1">
          ${stats.estimated_cost.toFixed(2)}
        </div>
        <div className="text-sm opacity-85">Estimated cost</div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-zinc-500">Token usage (30d)</span>
          <span className="text-lg font-bold">
            {formatTokens(chartData.reduce((sum, d) => sum + d.total, 0))}
          </span>
        </div>
        <div className="relative">
          <div className="flex items-end gap-0.5 h-12">
            {chartData.map((d, i) => {
              const height = (d.total / maxTotal) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-teal-500 to-teal-400 rounded-t cursor-pointer hover:from-teal-600 hover:to-teal-500 transition-all"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredBar({
                      index: i,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                />
              );
            })}
          </div>
          {hoveredBar && chartData[hoveredBar.index] && (
            <div
              className="absolute bottom-full mb-2 -translate-x-1/2 bg-zinc-800 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap z-10 shadow-lg border border-zinc-700"
              style={{
                left: `${(hoveredBar.index / chartData.length) * 100}%`,
              }}
            >
              <div className="font-semibold mb-1.5 pb-1.5 border-b border-white/20">
                {chartData[hoveredBar.index].date}
              </div>
              <div className="text-zinc-300 mb-0.5">
                ↓ {formatTokens(chartData[hoveredBar.index].input)}
              </div>
              <div className="text-zinc-300 mb-0.5">
                ↑ {formatTokens(chartData[hoveredBar.index].output)}
              </div>
              <div className="font-semibold mt-1.5 pt-1.5 border-t border-white/20">
                {formatTokens(chartData[hoveredBar.index].total)} total
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex-1 text-center">
            <span className="block text-base font-semibold">
              {formatTokens(
                chartData.length > 0
                  ? chartData[chartData.length - 1]?.total || 0
                  : 0,
              )}
            </span>
            <span className="text-xs text-zinc-500">Today</span>
          </div>
          <div className="flex-1 text-center">
            <span className="block text-base font-semibold">
              {formatTokens(
                chartData.slice(-7).reduce((sum, d) => sum + d.total, 0),
              )}
            </span>
            <span className="text-xs text-zinc-500">This week</span>
          </div>
          <div className="flex-1 text-center">
            <span className="block text-base font-semibold">
              {chartData[peakDayIndex]?.date || "-"}
            </span>
            <span className="text-xs text-zinc-500">Peak day</span>
          </div>
          <div className="flex-1 text-center">
            <span className="block text-base font-semibold">
              {(() => {
                const thisWeek = chartData
                  .slice(-7)
                  .reduce((sum, d) => sum + d.total, 0);
                const lastWeek = chartData
                  .slice(-14, -7)
                  .reduce((sum, d) => sum + d.total, 0);
                if (lastWeek === 0) return "-";
                const change = ((thisWeek - lastWeek) / lastWeek) * 100;
                return `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(0)}%`;
              })()}
            </span>
            <span className="text-xs text-zinc-500">vs last week</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-sm font-semibold mb-4">Activity heatmap</h2>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 ml-8 mb-1">
            {Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="flex-1 text-center text-[10px] text-zinc-500"
              >
                {i.toString().padStart(2, "0")}
              </span>
            ))}
          </div>
          {heatmapData.map((dayData, dayIdx) => (
            <div key={dayIdx} className="flex gap-1 items-center">
              <span className="w-7 text-right pr-1 text-xs text-zinc-500">
                {DAYS[dayIdx]}
              </span>
              {dayData.map((count, hourIdx) => (
                <div
                  key={hourIdx}
                  className="flex-1 aspect-square rounded cursor-pointer hover:scale-110 transition-transform min-h-4"
                  style={{
                    backgroundColor: count
                      ? `rgba(20, 184, 166, ${0.2 + (count / maxActivity) * 0.8})`
                      : "rgb(38, 38, 38)",
                  }}
                  title={`${DAYS[dayIdx]} ${hourIdx}:00 - ${count} messages`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-sm font-semibold mb-4">Top projects</h2>
        <div className="w-full">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={stats.project_stats.slice(0, 10).map((p) => ({
                name: p.name.split("/").pop() || p.name,
                tokens: p.total_input_tokens + p.total_output_tokens,
                sessions: p.session_count,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                type="number"
                stroke="#666"
                fontSize={11}
                tickFormatter={formatTokens}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#666"
                fontSize={11}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                }}
                labelStyle={{ color: "#999" }}
                formatter={(value) => [formatTokens(value as number), "Tokens"]}
              />
              <Bar dataKey="tokens" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
