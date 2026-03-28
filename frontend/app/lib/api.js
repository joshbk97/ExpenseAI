import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────
export const authApi = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// ── Receipts ─────────────────
export const receiptsApi = {
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/receipts/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  createManual: (data) => api.post("/receipts/manual", data),
  list: (params, config = {}) => api.get("/receipts", { ...config, params }),
  get: (id) => api.get(`/receipts/${id}`),
  categories: () => api.get("/receipts/categories/list"),
  updateItems: (id, data) => api.put(`/receipts/${id}/items`, data),
  delete: (id) => api.delete(`/receipts/${id}`),
};

// ── Expenses ─────────────────
export const expensesApi = {
  summary: (days = 30) => api.get("/expenses/summary", { params: { days } }),
  byCategory: (days = 30) => api.get("/expenses/by-category", { params: { days } }),
  trends: (days = 30) => api.get("/expenses/trends", { params: { days } }),
};

// ── NL Query ─────────────────
export const queryApi = {
  ask: (question) => api.post("/query", { question }),
};

// ── Insights ─────────────────
export const insightsApi = {
  get: (days = 30) => api.get("/insights", { params: { days } }),
};

export default api;
