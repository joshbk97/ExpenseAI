import { useEffect, useState } from "react";
import { Link } from "@remix-run/react";
import { format } from "date-fns";
import { Receipt, Search, Eye, Filter, Loader2, AlertCircle } from "lucide-react";
import { receiptsApi } from "~/lib/api";

const statusColors = {
  // Increased opacity + lighter text for better readability on glass backgrounds
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  processing: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function ReceiptsList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const hasFilters = Boolean(search || statusFilter);

  useEffect(() => {
    loadReceipts();
  }, [search, statusFilter]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const res = await receiptsApi.list({ 
        merchant: search || undefined,
        status: statusFilter || undefined
      });
      setReceipts(res.data.receipts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="text-2xl font-bold text-white">All Receipts</h2>
          <p className="text-gray-400">Manage and view your scanned receipts.</p>
        </div>
        <Link to="/dashboard/upload" className="btn-primary">
          Add Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search merchants..."
            className="input-field w-full pl-10 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-48 shrink-0">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <select
            className="input-field w-full pl-10 h-11 appearance-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            className="btn-secondary h-11"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-primary-500">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Receipt className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-lg">No receipts found</p>
            <p className="text-sm">Try adjusting your filters or upload a new one.</p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 text-sm bg-white/5">
                  <th className="p-4 font-semibold">Merchant</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <div className="font-semibold text-white">{r.merchant || "Unknown"}</div>
                      <div className="text-xs text-gray-400">ID: {r.id}</div>
                    </td>
                    <td className="p-4 text-gray-300">
                      {r.receipt_date ? format(new Date(r.receipt_date), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-4 font-semibold text-white">
                      ${r.total.toFixed(2)} {r.currency}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[r.status]}`}>
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/dashboard/receipts/${r.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10
                          text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20
                          transition-all opacity-90 group-hover:opacity-100"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-4 space-y-3">
            {receipts.map((r) => (
              <Link
                key={r.id}
                to={`/dashboard/receipts/${r.id}`}
                className="block glass-card-hover p-4 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{r.merchant || "Unknown"}</p>
                    <p className="text-xs text-gray-400">Receipt #{r.id}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[r.status]}`}>
                    <span className="capitalize">{r.status}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {r.receipt_date ? format(new Date(r.receipt_date), "MMM d, yyyy") : "No date"}
                  </span>
                  <span className="font-semibold text-white">${r.total.toFixed(2)} {r.currency}</span>
                </div>
              </Link>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
