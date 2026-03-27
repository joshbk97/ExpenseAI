import { useEffect, useState, useCallback } from "react";
import { Link } from "@remix-run/react";
import { useDropzone } from "react-dropzone";
import { Upload, X, CheckCircle, AlertCircle, FileText, ArrowRight, Keyboard } from "lucide-react";
import { receiptsApi } from "~/lib/api";

export default function UploadReceipt() {
  const [mode, setMode] = useState("upload");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, success, error
  const [errorObj, setErrorObj] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [manualForm, setManualForm] = useState({
    merchant: "",
    receipt_date: "",
    items: [{ name: "", quantity: 1, unit_price: "", category_id: "" }],
  });

  const onDrop = useCallback((acceptedFiles) => {
    const selected = acceptedFiles[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setStatus("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"]
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await receiptsApi.categories();
        setCategories(res.data || []);
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  const setManualItem = (index, field, value) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addManualItem = () => {
    setManualForm((prev) => ({
      ...prev,
      items: [...prev.items, { name: "", quantity: 1, unit_price: "", category_id: "" }],
    }));
  };

  const removeManualItem = (index) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const resetManualForm = () => {
    setManualForm({
      merchant: "",
      receipt_date: "",
      items: [{ name: "", quantity: 1, unit_price: "", category_id: "" }],
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorObj(null);
    try {
      const res = await receiptsApi.upload(file);
      setStatus("success");
      setReceiptId(res.data.id);
    } catch (err) {
      setStatus("error");
      setErrorObj(err.response?.data?.detail || "Failed to upload receipt");
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setStatus("idle");
    setReceiptId(null);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const cleanedItems = manualForm.items.map((item) => ({
      name: String(item.name || "").trim(),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      category_id: item.category_id === "" ? null : Number(item.category_id),
    }));
    const hasInvalid = cleanedItems.some(
      (item) =>
        !item.name ||
        !Number.isFinite(item.quantity) ||
        !Number.isFinite(item.unit_price) ||
        item.quantity <= 0 ||
        item.unit_price < 0
    );
    if (!String(manualForm.merchant || "").trim()) {
      setStatus("error");
      setErrorObj("Merchant name is required for manual entries.");
      return;
    }
    if (hasInvalid) {
      setStatus("error");
      setErrorObj("Please complete all line items with valid quantity and unit price.");
      return;
    }

    setStatus("uploading");
    setErrorObj(null);
    try {
      const res = await receiptsApi.createManual({
        merchant: manualForm.merchant.trim(),
        // Send date as YYYY-MM-DD to avoid timezone shifts / tz-aware datetimes.
        receipt_date: manualForm.receipt_date || null,
        items: cleanedItems,
      });
      setStatus("success");
      setReceiptId(res.data.id);
      resetManualForm();
    } catch (err) {
      setStatus("error");
      setErrorObj(err.response?.data?.detail || "Failed to create manual expense");
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Add Expense</h2>
        <p className="text-gray-400">Choose to upload a receipt or manually add expense details.</p>
      </div>

      <div className="glass-card p-6 md:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setStatus("idle");
              setErrorObj(null);
            }}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              mode === "upload"
                ? "border-primary-500/40 bg-primary-500/10 text-primary-300"
                : "border-white/10 bg-surface-900/40 text-gray-300 hover:bg-surface-900/70"
            }`}
          >
            <p className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Receipt</p>
            <p className="text-xs mt-1 text-gray-400">Use OCR to extract receipt details automatically.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("manual");
              setStatus("idle");
              setErrorObj(null);
            }}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              mode === "manual"
                ? "border-primary-500/40 bg-primary-500/10 text-primary-300"
                : "border-white/10 bg-surface-900/40 text-gray-300 hover:bg-surface-900/70"
            }`}
          >
            <p className="font-semibold flex items-center gap-2"><Keyboard className="w-4 h-4" /> Manual Entry</p>
            <p className="text-xs mt-1 text-gray-400">Add merchant, date, and line items directly.</p>
          </button>
        </div>

        {status === "success" ? (
          <div className="text-center py-10 space-y-6 animate-slide-up">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-white">{mode === "upload" ? "Upload Successful!" : "Expense Added!"}</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
              {mode === "upload"
                ? "Your receipt is now being processed by our AI pipeline. It usually takes 5-10 seconds to extract and categorise everything."
                : "Your manual expense has been saved using the same receipt and line item structure for consistent reporting."}
            </p>
            <div className="flex justify-center gap-4 pt-6">
              <button
                onClick={() => {
                  setStatus("idle");
                  setErrorObj(null);
                  if (mode === "upload") clearFile();
                  else resetManualForm();
                }}
                className="btn-secondary"
              >
                Add Another
              </button>
              <Link to={receiptId ? `/dashboard/receipts/${receiptId}` : "/dashboard/receipts"} className="btn-primary flex items-center gap-2">
                View Expense <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {mode === "upload" && !file ? (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer
                  ${isDragActive 
                    ? "border-primary-500 bg-primary-500/10" 
                    : "border-gray-600 hover:border-gray-500 hover:bg-white/5"}`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Upload className={`w-8 h-8 ${isDragActive ? "text-primary-400" : "text-gray-400"}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {isDragActive ? "Drop receipt here" : "Drag & drop your receipt"}
                </h3>
                <p className="text-sm text-gray-500">
                  Supports JPG, PNG, WEBP up to 10MB
                </p>
                <button className="btn-secondary mt-6">Browse Files</button>
              </div>
            ) : mode === "upload" ? (
              <div className="space-y-6 animate-slide-up">
                <div className="flex items-start justify-between bg-surface-800 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-900 border border-white/10 shrink-0">
                      <img src={preview} alt="Receipt preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={clearFile} className="p-2 text-gray-500 hover:text-red-400 transition-colors" disabled={status === "uploading"}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {status === "error" && (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{errorObj}</p>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleUpload}
                    disabled={status === "uploading"}
                    className="btn-primary flex items-center gap-2 px-8"
                  >
                    {status === "uploading" ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Scan & Process
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">Merchant</label>
                    <input
                      type="text"
                      className="input-field w-full"
                      value={manualForm.merchant}
                      onChange={(e) => setManualForm((prev) => ({ ...prev, merchant: e.target.value }))}
                      placeholder="e.g. Woolworths"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">Receipt Date</label>
                    <input
                      type="date"
                      className="input-field w-full"
                      value={manualForm.receipt_date}
                      onChange={(e) => setManualForm((prev) => ({ ...prev, receipt_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="bg-surface-900/60 p-3 text-sm text-gray-300 flex items-center justify-between">
                    <span>Line Items</span>
                    <button type="button" className="btn-secondary py-1.5" onClick={addManualItem}>Add Item</button>
                  </div>
                  <div className="p-3 space-y-3">
                    {manualForm.items.map((item, index) => (
                      <div key={`manual-item-${index}`} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 md:col-span-4">
                          <label className="block text-xs text-gray-400 mb-1">Item Name</label>
                          <input
                            type="text"
                            className="input-field w-full"
                            value={item.name}
                            onChange={(e) => setManualItem(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs text-gray-400 mb-1">Category</label>
                          <select
                            className="input-field w-full"
                            value={item.category_id}
                            onChange={(e) => setManualItem(index, "category_id", e.target.value)}
                          >
                            <option value="">Uncategorised</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3 md:col-span-2">
                          <label className="block text-xs text-gray-400 mb-1">Qty</label>
                          <input
                            type="number"
                            min="0.01"
                            className="input-field w-full"
                            value={item.quantity}
                            onChange={(e) => setManualItem(index, "quantity", e.target.value)}
                          />
                        </div>
                        <div className="col-span-3 md:col-span-2">
                          <label className="block text-xs text-gray-400 mb-1">Price (AUD)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-field w-full"
                            value={item.unit_price}
                            onChange={(e) => setManualItem(index, "unit_price", e.target.value)}
                          />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <label className="block text-xs text-gray-400 mb-1">Total</label>
                          <div className="input-field w-full h-[42px] flex items-center">
                            ${(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}
                          </div>
                        </div>
                        <div className="col-span-12">
                          <button
                            type="button"
                            disabled={manualForm.items.length === 1}
                            onClick={() => removeManualItem(index)}
                            className="text-xs text-red-300 hover:text-red-200 disabled:opacity-40"
                          >
                            Remove Item
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {status === "error" && (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{errorObj}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={status === "uploading"}
                    className="btn-primary flex items-center gap-2 px-8"
                  >
                    {status === "uploading" ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Manual Expense"
                    )}
                  </button>
                </div>
              </form>
            )}
            
            <div className="bg-primary-950/30 border border-primary-500/10 rounded-2xl p-5 flex gap-4 mt-8">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-primary-300">How it works</h4>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                  {mode === "upload"
                    ? "Our pipeline runs OCR to extract receipt text, sends it to a secure LLM to structure merchant/date/line items, and then auto-categorises each item with confidence scoring."
                    : "Manual entry saves your merchant, date, and line items directly into your expense ledger. Currency is fixed to AUD by default, and selected categories are used immediately in dashboards and reports."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
