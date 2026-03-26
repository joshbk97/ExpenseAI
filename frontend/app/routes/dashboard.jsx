import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "@remix-run/react";
import {
  LayoutDashboard,
  Upload,
  MessageSquare,
  Lightbulb,
  Receipt,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { authApi } from "~/lib/api";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/dashboard/upload", icon: Upload, label: "Add Expenses" },
  { to: "/dashboard/receipts", icon: Receipt, label: "View Expenses" },
  { to: "/dashboard/query", icon: MessageSquare, label: "Ask AI" },
  { to: "/dashboard/insights", icon: Lightbulb, label: "Insights" },
];

export default function DashboardLayout() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    authApi.me().then((res) => setUser(res.data)).catch(() => navigate("/login"));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const currentPageLabel =
    navItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    )?.label || "Dashboard";

  return (
    <div className="min-h-screen flex bg-surface-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface-800/80 backdrop-blur-xl border-r border-white/5 flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">ExpenseAI</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI-powered
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary-600/20 text-primary-400 border border-primary-500/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/5">
          {user && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
                {(user.full_name || user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.full_name || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">ExpenseAI</p>
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">{currentPageLabel}</h2>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => navigate("/dashboard/upload")}
            className="btn-primary hidden sm:inline-flex px-4 py-2 text-sm"
          >
            Add Expense
          </button>
          {user && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
              {(user.full_name || user.email)[0].toUpperCase()}
            </div>
          )}
        </header>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
