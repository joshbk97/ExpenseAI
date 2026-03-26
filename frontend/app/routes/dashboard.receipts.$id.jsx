import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "@remix-run/react";
import { format } from "date-fns";
import { ArrowLeft, Trash2, MapPin, Calendar, DollarSign, Loader2, AlertCircle, Sparkles, Pencil, Save, X, Plus } from "lucide-react";
import { receiptsApi } from "~/lib/api";

const statusColors = {
  // Increased opacity + lighter text for better readability on glass backgrounds
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  processing: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function ReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [editableItems, setEditableItems] = useState([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const toEditableItem = (item) => ({
    client_id: `item-${item.id}`,
    id: item.id,
    name: item.name || "",
    quantity: item.quantity || 1,
    category_id: item.category?.id ?? null,
    unit_price: item.unit_price || 0,
  });

  useEffect(() => {
    loadReceipt();
  }, [id]);

  // Poll if processing
  useEffect(() => {
    let interval;
    if (receipt?.status === "processing" || receipt?.status === "pending") {
      interval = setInterval(loadReceipt, 3000);
    }
    return () => clearInterval(interval);
  }, [receipt?.status]);

  const loadReceipt = async () => {
    try {
      const res = await receiptsApi.get(id);
      setReceipt(res.data);
      setEditableItems((res.data.items || []).map(toEditableItem));
      setIsDirty(false);
    } catch (err) {
      setError("Receipt not found or you don't have access.");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await receiptsApi.categories();
      setCategories(res.data || []);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const updateEditableItem = (itemClientId, field, value) => {
    setIsDirty(true);
    setEditableItems((prev) =>
      prev.map((item) => (item.client_id === itemClientId ? { ...item, [field]: value } : item))
    );
  };

  const addEditableItem = () => {
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setIsDirty(true);
    setEditableItems((prev) => [
      ...prev,
      {
        client_id: key,
        id: null,
        name: "",
        quantity: 1,
        category_id: null,
        unit_price: 0,
      },
    ]);
  };

  const removeEditableItem = (itemClientId, itemName = "") => {
    const label = String(itemName || "").trim();
    const message = label
      ? `Remove "${label}" from this receipt? The change applies when you save.`
      : "Remove this line item from this receipt? The change applies when you save.";
    if (!confirm(message)) return;
    setIsDirty(true);
    setEditableItems((prev) => prev.filter((item) => item.client_id !== itemClientId));
  };

  const normalizeCategoryId = (value) => {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isItemModified = (item) => {
    if (item.id == null) return true;
    const original = (receipt?.items || []).find((r) => r.id === item.id);
    if (!original) return true;

    const originalCategoryId = original.category?.id ?? null;
    return (
      String(item.name || "").trim() !== String(original.name || "").trim() ||
      Number(item.quantity ?? 0) !== Number(original.quantity ?? 0) ||
      Number(item.unit_price ?? 0) !== Number(original.unit_price ?? 0) ||
      normalizeCategoryId(item.category_id) !== originalCategoryId
    );
  };

  const startEditing = () => {
    setEditing(true);
    setIsDirty(false);
    setSaveMessage("");
  };

  const handleSaveItems = async () => {
    if (!isDirty) return;
    const changedItems = editableItems.filter(isItemModified);
    const deletedItemIds = (receipt?.items || [])
      .map((item) => item.id)
      .filter((itemId) => !editableItems.some((editableItem) => editableItem.id === itemId));
    const hasInvalidItems = changedItems.some(
      (item) =>
        String(item.name || "").trim().length === 0 ||
        !Number.isFinite(Number(item.quantity)) ||
        !Number.isFinite(Number(item.unit_price)) ||
        Number(item.quantity) < 0 ||
        Number(item.unit_price) < 0
    );

    if (hasInvalidItems) {
      alert("Please fill all item names and ensure quantity/price are not negative.");
      return;
    }

    if (changedItems.length === 0 && deletedItemIds.length === 0) {
      setIsDirty(false);
      return;
    }

    setSaving(true);
    setSaveMessage("");
    try {
      const payload = {
        items: changedItems.map((item) => ({
          id: item.id ?? null,
          name: String(item.name || "").trim(),
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          category_id: normalizeCategoryId(item.category_id),
        })),
        deleted_item_ids: deletedItemIds,
      };
      const res = await receiptsApi.updateItems(id, payload);
      setReceipt(res.data);
      setEditableItems((res.data.items || []).map(toEditableItem));
      setEditing(false);
      setIsDirty(false);
      setSaveMessage("Mappings saved.");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
        : detail || "Failed to save item changes";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditableItems((receipt?.items || []).map(toEditableItem));
    setEditing(false);
    setIsDirty(false);
    setSaveMessage("");
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this receipt? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await receiptsApi.delete(id);
      navigate("/dashboard/receipts");
    } catch (err) {
      alert("Failed to delete receipt");
      setDeleting(false);
    }
  };

  if (loading && !receipt) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
        <AlertCircle className="w-12 h-12 text-red-700 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-red-100 mb-2">Error</h3>
        <p className="text-red-200">{error}</p>
        <Link to="/dashboard/receipts" className="btn-secondary mt-6 inline-flex">Go Back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/receipts" className="p-2 glass-card hover:bg-white/85 transition-colors text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-white">Receipt #{receipt.id}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${statusColors[receipt.status]}`}>
            {receipt.status}
          </span>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary text-red-300 hover:text-red-200 hover:bg-red-500/10 border-transparent hover:border-red-500/20 flex items-center gap-2"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete
        </button>
      </div>
      {saveMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
          {saveMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Image & Raw Text */}
        <div className="space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <h3 className="flex w-full font-semibold text-white items-center gap-2 border-b border-white/10 pb-2">
                Original Image
              </h3>
            </div>
            <div className="p-4 bg-black/40 flex justify-center max-h-[500px] overflow-auto">
              {receipt.image_path ? (
                <img
                  src={`/${receipt.image_path.replace(/\\/g, "/")}`}
                  alt="Receipt"
                  className="max-w-full h-auto object-contain rounded-lg"
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/400x600?text=Image+Not+Found" }}
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-300">No image available</div>
              )}
            </div>
          </div>

          <details className="glass-card group max-h-96 overflow-y-auto">
            <summary className="p-4 font-semibold text-gray-200 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors">
              <span className="flex w-full border-b border-white/10 pb-2">Raw OCR Output</span>
            </summary>
            <div className="p-4">
              <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono">
                {receipt.raw_text || "No text extracted"}
              </pre>
            </div>
          </details>
        </div>

        {/* Right Column: Structured Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
               <Sparkles className="w-5 h-5 text-primary-400" /> Extracted Summary
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Merchant
                </p>
                <p className="font-semibold text-white text-lg truncate" title={receipt.merchant}>
                  {receipt.merchant || "Unknown"}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date
                </p>
                <p className="font-semibold text-white text-lg">
                  {receipt.receipt_date ? format(new Date(receipt.receipt_date), "MMM d, yyyy") : "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3" /> Total
                </p>
                <p className="font-semibold text-white text-lg">
                  ${receipt.total.toFixed(2)} <span className="text-sm text-gray-300 font-normal">{receipt.currency}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-card overflow-hidden">
             <div className="p-6 flex items-center justify-between">
              <h3 className="flex-1 font-semibold text-white text-lg border-b border-white/10 pb-2">
                Line Items
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-200 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {(editing ? editableItems.length : receipt.items.length)} items found
                </span>
                {!editing ? (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit items
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={addEditableItem}
                      disabled={saving}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add item
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveItems}
                      disabled={saving || !isDirty}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {(editing ? editableItems.length : receipt.items.length) > 0 ? (
              <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5">
                    <tr className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      <th className="p-4">Item Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 text-right">Qty</th>
                      <th className="p-4 text-right">Price</th>
                      <th className="p-4 text-right">Total</th>
                      {editing && <th className="p-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {(editing ? editableItems : receipt.items).map((item) => {
                      const editable = editing ? item : editableItems.find((it) => it.id === item.id);
                      const quantityValue = Number(editable?.quantity ?? item.quantity);
                      const unitPriceValue = Number(editable?.unit_price ?? item.unit_price);
                      const computedTotal = (Number.isFinite(quantityValue) ? quantityValue : item.quantity) * (Number.isFinite(unitPriceValue) ? unitPriceValue : item.unit_price);
                      return (
                      <tr key={editing ? item.client_id : item.id} className="hover:bg-white/10 transition-colors group">
                        <td className="p-4">
                          {editing ? (
                            <input
                              type="text"
                              value={editable?.name ?? ""}
                              onChange={(e) => updateEditableItem(item.client_id, "name", e.target.value)}
                              className="w-full bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900"
                            />
                          ) : (
                            <p className="font-medium text-gray-200">{item.name}</p>
                          )}
                        </td>
                        <td className="p-4">
                          {editing ? (
                            <select
                              value={editable?.category_id ?? ""}
                              onChange={(e) => updateEditableItem(item.client_id, "category_id", e.target.value)}
                              className="w-full bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900"
                            >
                              <option value="">Uncategorised</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.icon} {category.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              {item.category ? (
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-lg text-sm border border-white/10 shadow-sm text-gray-200">
                                    {item.category.icon}
                                  </span>
                                  <div>
                                    <span className="text-sm text-gray-300 block">{item.category.name}</span>
                                    {/* {item.category_confidence && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <div className="w-16 h-1 bg-surface-700 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full ${item.category_confidence > 0.8 ? "bg-emerald-500" : item.category_confidence > 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                                            style={{ width: `${item.category_confidence * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-500">{(item.category_confidence * 100).toFixed(0)}%</span>
                                      </div>
                                    )} */}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-sm">Uncategorised</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-4 text-right text-sm text-gray-300">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editable?.quantity ?? 0}
                              onChange={(e) => updateEditableItem(item.client_id, "quantity", e.target.value)}
                              className="w-24 ml-auto bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900 text-right"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="p-4 text-right text-sm text-gray-300">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editable?.unit_price ?? 0}
                              onChange={(e) => updateEditableItem(item.client_id, "unit_price", e.target.value)}
                              className="w-28 ml-auto bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900 text-right"
                            />
                          ) : (
                            `$${item.unit_price.toFixed(2)}`
                          )}
                        </td>
                        <td className="p-4 text-right font-medium text-gray-100">
                          ${(editing ? computedTotal : item.total_price).toFixed(2)}
                        </td>
                        {editing && (
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() => removeEditableItem(item.client_id, item.name)}
                              className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden p-4 space-y-3">
                {(editing ? editableItems : receipt.items).map((item) => {
                  const editable = editing ? item : editableItems.find((it) => it.id === item.id);
                  const quantityValue = Number(editable?.quantity ?? item.quantity);
                  const unitPriceValue = Number(editable?.unit_price ?? item.unit_price);
                  const computedTotal = (Number.isFinite(quantityValue) ? quantityValue : item.quantity) * (Number.isFinite(unitPriceValue) ? unitPriceValue : item.unit_price);
                  return (
                    <div key={editing ? item.client_id : item.id} className="rounded-xl border border-gray-200/70 bg-gray-50/90 p-4 space-y-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Item Name</p>
                        {editing ? (
                          <input
                            type="text"
                            value={editable?.name ?? ""}
                            onChange={(e) => updateEditableItem(item.client_id, "name", e.target.value)}
                            className="w-full bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 font-medium">{item.name}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Category</p>
                        {editing ? (
                          <select
                            value={editable?.category_id ?? ""}
                            onChange={(e) => updateEditableItem(item.client_id, "category_id", e.target.value)}
                            className="w-full bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900"
                          >
                            <option value="">Uncategorised</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm text-gray-700">{item.category ? `${item.category.icon} ${item.category.name}` : "Uncategorised"}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Qty</p>
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editable?.quantity ?? 0}
                              onChange={(e) => updateEditableItem(item.client_id, "quantity", e.target.value)}
                              className="w-full bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900"
                            />
                          ) : (
                            <p className="text-sm text-gray-700">{item.quantity}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Price</p>
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editable?.unit_price ?? 0}
                              onChange={(e) => updateEditableItem(item.client_id, "unit_price", e.target.value)}
                              className="w-full bg-white border border-gray-200/70 rounded-lg px-3 py-2 text-sm text-gray-900"
                            />
                          ) : (
                            <p className="text-sm text-gray-700">${item.unit_price.toFixed(2)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Total</p>
                          <p className="text-sm text-gray-900 font-medium">${(editing ? computedTotal : item.total_price).toFixed(2)}</p>
                        </div>
                      </div>
                      {editing && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => removeEditableItem(item.client_id, item.name)}
                            className="inline-flex items-center gap-1 text-xs text-red-700 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove item
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            ) : (
              <div className="p-12 text-center">
                {receipt.status === "processing" ? (
                  <div className="flex flex-col items-center text-primary-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <p>Extracting line items...</p>
                  </div>
                ) : (
                  <div className="text-gray-300">
                    <p className="text-lg mb-1">No items found</p>
                    <p className="text-sm">We couldn't extract any specific line items from this receipt.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          {editing ? (
            <div className="md:hidden sticky bottom-3 z-10">
              <div className="glass-card p-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveItems}
                  disabled={saving || !isDirty}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
