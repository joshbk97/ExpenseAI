import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from "recharts";
import { DollarSign, Receipt, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { expensesApi } from "~/lib/api";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#10b981", "#64748b"];

export default function DashboardIndex() {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, catRes, trendRes] = await Promise.all([
        expensesApi.summary(),
        expensesApi.byCategory(),
        expensesApi.trends(),
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
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 flex items-center justify-between bg-red-500/5 border-red-500/20">
        <div className="flex items-center gap-4 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <p>{error}</p>
        </div>
        <button onClick={loadData} className="btn-secondary">Retry</button>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-gray-400">Your spending at a glance (Last 30 days)</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card border-t-[3px] border-t-primary-500">
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

        <div className="stat-card border-t-[3px] border-t-violet-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Receipts Processed</p>
              <h3 className="text-3xl font-bold text-white">{summary?.receipt_count || 0}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="stat-card border-t-[3px] border-t-pink-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Items Added</p>
              <h3 className="text-3xl font-bold text-white">{summary?.item_count || 0}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="stat-card border-t-[3px] border-t-emerald-500">
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
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Trends */}
        <div className="glass-card p-6 h-96">
          <h3 className="text-lg font-semibold text-white mb-6">Daily Spending Trends</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                  itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 italic">No data available</div>
          )}
        </div>

        {/* Categories Breakdown */}
        <div className="glass-card p-6 h-96">
          <h3 className="text-lg font-semibold text-white mb-6">Spending by Category</h3>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="category_name"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                  formatter={(value) => [`$${value.toFixed(2)}`, "Spent"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 italic">No data available</div>
          )}
        </div>
      </div>

      {/* Categories Bar Chart */}
      <div className="glass-card p-6 h-96">
        <h3 className="text-lg font-semibold text-white mb-6">Category Comparison</h3>
        {categories.length > 0 ? (
           <ResponsiveContainer width="100%" height="85%">
             <BarChart data={categories} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
               <XAxis dataKey="category_name" stroke="#94a3b8" tick={{fontSize: 12}} />
               <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${v}`} />
               <Tooltip 
                 cursor={{fill: '#334155', opacity: 0.4}}
                 contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
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
