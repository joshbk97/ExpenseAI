import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from "recharts";
import { DollarSign, Receipt, TrendingUp, Calendar, AlertCircle, Clock, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { expensesApi } from "~/lib/api";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#10b981", "#64748b"];

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "0.6rem",
    color: "#f8fafc",
    fontSize: "0.8rem",
    padding: "6px 10px",
  },
  labelStyle: { color: "#f1f5f9", fontWeight: 600, fontSize: "0.8rem" },
  itemStyle: { color: "#818cf8", fontWeight: "600", fontSize: "0.8rem" },
};

const formatDateTick = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = parseISO(dateStr);
    return format(d, "MMM d");
  } catch {
    return dateStr;
  }
};

const formatDateFull = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = parseISO(dateStr);
    return format(d, "MMM d, yyyy");
  } catch {
    return dateStr;
  }
};

const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  if (percent < 0.02) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 10;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#cbd5e1"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={500}
    >
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const KpiCardSkeleton = () => (
  <div className="stat-card animate-pulse">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <div className="h-3.5 w-24 bg-surface-700/60 rounded-md"></div>
        <div className="h-7 w-32 bg-surface-700/80 rounded-lg"></div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-surface-700/60 shrink-0"></div>
    </div>
  </div>
);

const ChartSkeleton = ({ type = "line" }) => (
  <div className="h-full flex flex-col justify-between pt-2">
    {type === "pie" ? (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-40 h-40 rounded-full border-[18px] border-surface-700/50 border-t-surface-600 animate-pulse flex items-center justify-center shadow-inner">
          <div className="w-16 h-16 rounded-full bg-surface-800/80"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-14 bg-surface-700/50 rounded animate-pulse"></div>
          <div className="h-3 w-16 bg-surface-700/50 rounded animate-pulse"></div>
          <div className="h-3 w-12 bg-surface-700/50 rounded animate-pulse"></div>
        </div>
      </div>
    ) : type === "bar" ? (
      <div className="flex-1 flex items-end justify-between gap-3 px-4 pb-4">
        {[40, 75, 55, 90, 30, 65, 80].map((h, i) => (
          <div
            key={i}
            className="w-full bg-surface-700/50 rounded-t-md animate-pulse"
            style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
          ></div>
        ))}
      </div>
    ) : (
      <div className="flex-1 flex flex-col justify-end gap-2 px-2 pb-4">
        <div className="w-full h-full flex items-end justify-between gap-2 border-b border-surface-700/40 pb-2">
          {[30, 45, 60, 40, 70, 50, 85, 65, 95, 80].map((h, i) => (
            <div
              key={i}
              className="w-full bg-gradient-to-t from-primary-500/20 to-primary-500/5 rounded-t animate-pulse"
              style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
            ></div>
          ))}
        </div>
        <div className="flex justify-between px-1">
          {[1, 2, 3, 4, 5].map((_, i) => (
            <div key={i} className="h-2.5 w-8 bg-surface-700/40 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default function DashboardIndex() {
  const [days, setDays] = useState(0); // 0 = All Time
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async (targetDays = days) => {
    try {
      setLoading(true);
      setError("");
      const [sumRes, catRes, trendRes] = await Promise.all([
        expensesApi.summary(targetDays),
        expensesApi.byCategory(targetDays),
        expensesApi.trends(targetDays),
      ]);
      setSummary(sumRes.data);
      setCategories(catRes.data);
      setTrends(trendRes.data);
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(days);
  }, [days]);

  const getSubTitleText = () => {
    if (!summary) return "";
    const start = summary.period_start ? formatDateFull(summary.period_start) : "";
    const end = summary.period_end ? formatDateFull(summary.period_end) : "";
    if (start && end) {
      return `${start} – ${end}`;
    }
    return days === 0 ? "All Time spending" : `Last ${days} days`;
  };

  if (loading && !summary) {
    return (
      <div className="page-shell">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-surface-700/60 rounded-lg animate-pulse"></div>
            <div className="h-4 w-36 bg-surface-700/40 rounded-md animate-pulse"></div>
          </div>
          <div className="h-9 w-64 bg-surface-800/80 rounded-xl border border-white/10 animate-pulse"></div>
        </div>

        {/* KPI Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>

        {/* Charts Row 1 Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 h-96">
            <div className="h-5 w-44 bg-surface-700/60 rounded-md mb-6 animate-pulse"></div>
            <ChartSkeleton type="line" />
          </div>
          <div className="glass-card p-6 h-96">
            <div className="h-5 w-44 bg-surface-700/60 rounded-md mb-6 animate-pulse"></div>
            <ChartSkeleton type="pie" />
          </div>
        </div>

        {/* Bar Chart Skeleton */}
        <div className="glass-card p-6 h-96">
          <div className="h-5 w-44 bg-surface-700/60 rounded-md mb-6 animate-pulse"></div>
          <ChartSkeleton type="bar" />
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="glass-card p-6 flex items-center justify-between bg-red-500/5 border-red-500/20">
        <div className="flex items-center gap-4 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <p>{error}</p>
        </div>
        <button onClick={() => loadData(days)} className="btn-secondary">Retry</button>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header with Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-gray-400 flex items-center gap-1.5 mt-1">
            <Clock className="w-4 h-4 text-primary-400" />
            <span>{getSubTitleText()}</span>
          </p>
        </div>

        {/* Time period filter controls */}
        <div className="flex items-center gap-1 bg-surface-800/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          {[
            { label: "All Time", value: 0 },
            { label: "30 Days", value: 30 },
            { label: "90 Days", value: 90 },
            { label: "6 Months", value: 180 },
            { label: "1 Year", value: 365 },
          ].map((option) => (
            <button
              key={option.value}
              disabled={loading}
              onClick={() => setDays(option.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                days === option.value
                  ? "bg-primary-600 text-white shadow-md shadow-primary-900/40"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {loading && days === option.value && <Loader2 className="w-3 h-3 animate-spin text-white" />}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <KpiCardSkeleton />
        ) : (
          <div className="stat-card relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Total Spent</p>
                <h3 className="text-3xl font-bold text-white">${summary?.total_spent?.toFixed(2) || "0.00"}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <KpiCardSkeleton />
        ) : (
          <div className="stat-card relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Top Merchant</p>
                <h3 className="text-xl font-bold text-white mt-1 border-gray-600 pb-1">
                  {summary?.top_merchant || "N/A"}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Trends */}
        <div className="glass-card p-6 h-96 relative overflow-hidden">
          <h3 className="text-lg font-semibold text-white mb-6">Daily Spending Trends</h3>
          {loading ? (
            <ChartSkeleton type="line" />
          ) : trends.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={trends} margin={{ top: 10, right: 20, left: 10, bottom: 15 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={formatDateTick}
                  minTickGap={25}
                  dy={5}
                />
                <YAxis
                  stroke="#94a3b8"
                  width={55}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  labelFormatter={(label) => formatDateFull(label)}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, "Total Spent"]}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 italic">No data available</div>
          )}
        </div>

        {/* Categories Breakdown */}
        <div className="glass-card p-6 h-96 relative overflow-hidden">
          <h3 className="text-lg font-semibold text-white mb-6">Spending by Category</h3>
          {loading ? (
            <ChartSkeleton type="pie" />
          ) : categories.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="total"
                  nameKey="category_name"
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value, name, props) => [`${props?.payload?.percentage ?? (value ? value.toFixed(1) : 0)}%`]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 italic">No data available</div>
          )}
        </div>
      </div>

      {/* Categories Bar Chart */}
      <div className="glass-card p-6 h-96 relative overflow-hidden">
        <h3 className="text-lg font-semibold text-white mb-6">Category Comparison</h3>
        {loading ? (
          <ChartSkeleton type="bar" />
        ) : categories.length > 0 ? (
           <ResponsiveContainer width="100%" height="85%">
             <BarChart data={categories} margin={{ top: 10, right: 20, left: 10, bottom: 15 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
               <XAxis dataKey="category_name" stroke="#94a3b8" tick={{ fontSize: 11, fill: "#94a3b8" }} dy={5} />
               <YAxis
                 stroke="#94a3b8"
                 width={55}
                 tick={{ fontSize: 11, fill: "#94a3b8" }}
                 tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
               />
               <Tooltip
                 {...CHART_TOOLTIP}
                 cursor={{ fill: "#334155", opacity: 0.4 }}
                 formatter={(value) => [`$${Number(value).toFixed(2)}`, "Total Spent"]}
               />
               <Bar dataKey="total" name="Total Spent" radius={[4, 4, 0, 0]}>
                 {categories.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 italic">No data available</div>
        )}
      </div>
    </div>
  );
}
