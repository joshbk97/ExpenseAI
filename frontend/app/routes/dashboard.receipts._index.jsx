import { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "@remix-run/react";
import { format } from "date-fns";
import { Receipt, Search, Eye, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from "lucide-react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" = Newest purchase date first, "asc" = Oldest purchase date first
  const hasFilters = Boolean(merchantSearch.trim());
  const hasEverHadReceipts = useRef(false);
  const abortRef = useRef(null);

  const needle = merchantSearch.trim().toLowerCase();
  const filteredReceipts = useMemo(() => {
    let result = receipts;
    if (needle) {
      result = receipts.filter((r) => (r.merchant || "").toLowerCase().includes(needle));
    }

    return [...result].sort((a, b) => {
      const timeA = a.receipt_date
        ? new Date(a.receipt_date).getTime()
        : a.created_at
        ? new Date(a.created_at).getTime()
        : 0;
      const timeB = b.receipt_date
        ? new Date(b.receipt_date).getTime()
        : b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      if (timeA !== timeB) {
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      }
      return sortOrder === "desc" ? b.id - a.id : a.id - b.id;
    });
  }, [receipts, needle, sortOrder]);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const isFirstLoad = !hasEverHadReceipts.current;
    if (isFirstLoad) setLoading(true);
    else setRefreshing(true);

    (async () => {
      try {
        const pageSize = 100;
        const all = [];
        let page = 1;
        let total = null;

        while (page <= 100) {
          const res = await receiptsApi.list(
            {
              page,
              page_size: pageSize,
            },
            { signal: ac.signal }
          );
          if (ac.signal.aborted) return;

          const batch = res.data.receipts ?? [];
          if (total === null) total = res.data.total ?? 0;
          all.push(...batch);

          if (batch.length === 0 || all.length >= total || batch.length < pageSize) break;
          page++;
        }

        if (ac.signal.aborted) return;
        setReceipts(all);
      } catch (err) {
        if (err.code === "ERR_CANCELED" || err.name === "CanceledError") return;
        console.error(err);
      } finally {
        if (ac.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
        hasEverHadReceipts.current = true;
      }
    })();

    return () => ac.abort();
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="text-2xl font-bold text-white">All Expenses</h2>
          <p className="text-gray-400">Manage and view your scanned receipts and expenses.</p>
        </div>
        <Link to="/dashboard/upload" className="btn-primary">
          Add Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search merchants..."
            className="input-field w-full pl-10 h-11"
            value={merchantSearch}
            onChange={(e) => setMerchantSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="btn-secondary h-11 flex items-center gap-2 text-sm whitespace-nowrap"
            title="Toggle chronological order (Purchase Date)"
          >
            <ArrowUpDown className="w-4 h-4 text-primary-400" />
            <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
          </button>
          {hasFilters && (
            <button
              type="button"
              className="btn-secondary h-11"
              onClick={() => {
                setMerchantSearch("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div
        className={`glass-card overflow-hidden transition-opacity duration-200 ${
          refreshing && filteredReceipts.length > 0 ? "opacity-[0.72]" : ""
        }`}
      >
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
        ) : filteredReceipts.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Search className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-lg">No matching merchants</p>
            <p className="text-sm">Try a different search or clear the merchant filter.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 text-sm bg-white/5">
                    <th className="p-4 font-semibold">Merchant</th>
                    <th
                      className="p-4 font-semibold cursor-pointer hover:text-white transition-colors select-none group/date"
                      onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                      title="Click to toggle chronological sort order"
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Purchase Date</span>
                        {sortOrder === "desc" ? (
                          <ArrowDown className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                    </th>
                    <th className="p-4 font-semibold">Amount</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4">
                        <div className="font-semibold text-white">{r.merchant || "Unknown"}</div>
                      </td>
                      <td className="p-4 text-gray-300 font-medium">
                        {r.receipt_date ? format(new Date(r.receipt_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="p-4 font-semibold text-white">${r.total.toFixed(2)}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            statusColors[r.status]
                          }`}
                        >
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
              {filteredReceipts.map((r) => (
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
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        statusColors[r.status]
                      }`}
                    >
                      <span className="capitalize">{r.status}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-primary-300 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary-400" />
                      {r.receipt_date ? format(new Date(r.receipt_date), "MMM d, yyyy") : "No date"}
                    </span>
                    <span className="font-semibold text-white">${r.total.toFixed(2)}</span>
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
