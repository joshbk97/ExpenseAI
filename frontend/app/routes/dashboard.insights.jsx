import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Lightbulb, TrendingDown, TrendingUp, AlertTriangle, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { insightsApi } from "~/lib/api";

const getIcon = (insight) => {
  const lower = insight.toLowerCase();
  if (lower.includes("higher") || lower.includes("increase")) return <TrendingUp className="w-5 h-5 text-red-400" />;
  if (lower.includes("lower") || lower.includes("decrease") || lower.includes("saving")) return <TrendingDown className="w-5 h-5 text-emerald-400" />;
  if (lower.includes("unusual") || lower.includes("warning")) return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
  return <Lightbulb className="w-5 h-5 text-primary-400" />;
};

export default function Insights() {
  const [days, setDays] = useState(0); // 0 = All Time
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadInsights = async (targetDays = days) => {
    setLoading(true);
    try {
      const res = await insightsApi.get(targetDays);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights(days);
  }, [days]);

  if (loading && !data) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-gray-400 animate-pulse">AI is analysing your spending patterns...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            AI Insights <Sparkles className="w-5 h-5 text-violet-400" />
          </h2>
          <p className="text-gray-400">
            {days === 0 ? "Personalised financial analysis across all receipt data." : `Personalised financial analysis for the last ${days} days.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-800/80 p-1 rounded-xl border border-white/10">
            {[
              { label: "All Time", value: 0 },
              { label: "30 Days", value: 30 },
              { label: "90 Days", value: 90 },
              { label: "1 Year", value: 365 },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDays(option.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  days === option.value
                    ? "bg-primary-600 text-white shadow-md shadow-primary-900/40"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => loadInsights(days)} 
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {data?.insights?.map((insight, idx) => (
          <div 
            key={idx} 
            className="glass-card p-6 flex gap-4 items-start relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Soft background glow based on index */}
            <div className={`absolute -right-20 -top-20 w-40 h-40 blur-3xl opacity-20 rounded-full bg-gradient-to-br transition-opacity duration-500 group-hover:opacity-40
              ${idx % 3 === 0 ? "from-primary-500 to-violet-500" : 
                idx % 3 === 1 ? "from-emerald-500 to-teal-500" : "from-pink-500 to-orange-500"}`} 
            />
            
            <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-white/5 flex items-center justify-center shrink-0 z-10 shadow-lg">
              {getIcon(insight)}
            </div>
            
            <div className="z-10 pt-1">
              <p className="text-gray-200 text-lg leading-relaxed">{insight}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-12 pb-8">
        <p className="text-xs text-gray-500">
          Analysis generated on {data?.generated_at ? format(new Date(data.generated_at), "MMM d, yyyy 'at' h:mm a") : "recently"} utilizing semantic search over {data?.data_summary?.receipt_count || 0} receipts.
        </p>
      </div>
    </div>
  );
}
