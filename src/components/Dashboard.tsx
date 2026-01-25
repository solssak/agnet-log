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

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

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
      <div className="dashboard-inline">
        <div className="loading">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-inline">
        <div className="loading">Failed to load statistics</div>
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

  return (
    <div className="dashboard-inline">
      <div className="stats-split">
        <div className="stats-section">
          <div className="stats-section-label">Tokens</div>
          <div className="stats-row">
            <span className="stats-icon">↓</span>
            <span className="stats-value">
              {formatTokens(stats.total_input_tokens)}
            </span>
            <span className="stats-label">input</span>
          </div>
          <div className="stats-row">
            <span className="stats-icon">↑</span>
            <span className="stats-value">
              {formatTokens(stats.total_output_tokens)}
            </span>
            <span className="stats-label">output</span>
          </div>
        </div>
        <div className="stats-section">
          <div className="stats-section-label">Activity</div>
          <div className="stats-row">
            <span className="stats-value">
              {stats.total_sessions.toLocaleString()}
            </span>
            <span className="stats-label">sessions</span>
          </div>
          <div className="stats-row">
            <span className="stats-value">
              {stats.total_messages.toLocaleString()}
            </span>
            <span className="stats-label">messages</span>
          </div>
          <div className="stats-row">
            <span className="stats-value">
              {formatDuration(stats.avg_session_minutes)}
            </span>
            <span className="stats-label">avg time</span>
          </div>
        </div>
      </div>
      <div className="stats-hero">
        <div className="stats-hero-value">
          ${stats.estimated_cost.toFixed(2)}
        </div>
        <div className="stats-hero-label">Estimated cost</div>
      </div>

      <div className="sparkline-section">
        <div className="sparkline-header">
          <span className="sparkline-title">Token usage (30d)</span>
          <span className="sparkline-total">
            {formatTokens(chartData.reduce((sum, d) => sum + d.total, 0))}
          </span>
        </div>
        <div className="sparkline-bars-container">
          <div className="sparkline-bars">
            {chartData.map((d, i) => {
              const maxTotal = Math.max(...chartData.map((x) => x.total), 1);
              const height = (d.total / maxTotal) * 100;
              return (
                <div
                  key={i}
                  className="sparkline-bar"
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
              className="sparkline-tooltip"
              style={{
                left: `${(hoveredBar.index / chartData.length) * 100}%`,
              }}
            >
              <div className="sparkline-tooltip-date">
                {chartData[hoveredBar.index].date}
              </div>
              <div className="sparkline-tooltip-row">
                <span>↓</span> {formatTokens(chartData[hoveredBar.index].input)}
              </div>
              <div className="sparkline-tooltip-row">
                <span>↑</span>{" "}
                {formatTokens(chartData[hoveredBar.index].output)}
              </div>
              <div className="sparkline-tooltip-total">
                {formatTokens(chartData[hoveredBar.index].total)} total
              </div>
            </div>
          )}
        </div>
        <div className="sparkline-summary">
          <div className="sparkline-stat">
            <span className="sparkline-stat-value">
              {formatTokens(
                chartData.length > 0
                  ? chartData[chartData.length - 1]?.total || 0
                  : 0,
              )}
            </span>
            <span className="sparkline-stat-label">Today</span>
          </div>
          <div className="sparkline-stat">
            <span className="sparkline-stat-value">
              {formatTokens(
                chartData.slice(-7).reduce((sum, d) => sum + d.total, 0),
              )}
            </span>
            <span className="sparkline-stat-label">This week</span>
          </div>
          <div className="sparkline-stat">
            <span className="sparkline-stat-value">
              {chartData.reduce(
                (max, d, i) =>
                  d.total > (chartData[max]?.total || 0) ? i : max,
                0,
              ) >= 0
                ? chartData[
                    chartData.reduce(
                      (max, d, i) =>
                        d.total > (chartData[max]?.total || 0) ? i : max,
                      0,
                    )
                  ]?.date || "-"
                : "-"}
            </span>
            <span className="sparkline-stat-label">Peak day</span>
          </div>
          <div className="sparkline-stat">
            <span className="sparkline-stat-value">
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
            <span className="sparkline-stat-label">vs last week</span>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <h2>Activity heatmap</h2>
        <div className="heatmap">
          <div className="heatmap-hours">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="hour-label">
                {i.toString().padStart(2, "0")}
              </span>
            ))}
          </div>
          {heatmapData.map((dayData, dayIdx) => (
            <div key={dayIdx} className="heatmap-row">
              <span className="day-label">{DAYS[dayIdx]}</span>
              {dayData.map((count, hourIdx) => (
                <div
                  key={hourIdx}
                  className="heatmap-cell"
                  style={{
                    backgroundColor: count
                      ? `rgba(37, 99, 235, ${0.2 + (count / maxActivity) * 0.8})`
                      : "#252525",
                  }}
                  title={`${DAYS[dayIdx]} ${hourIdx}:00 - ${count} messages`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="chart-section">
        <h2>Top projects</h2>
        <div className="chart-container">
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
              <Bar dataKey="tokens" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
