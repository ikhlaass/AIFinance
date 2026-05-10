import React, { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

const loadDashboard = () => import("./pages/Dashboard");
const loadTransactions = () => import("./pages/Transactions");
const loadAssets = () => import("./pages/Assets");
const loadDebts = () => import("./pages/Debts");
const loadReports = () => import("./pages/Reports");
const loadSettings = () => import("./pages/Settings");

const Dashboard = lazy(loadDashboard);
const Transactions = lazy(loadTransactions);
const Assets = lazy(loadAssets);
const Debts = lazy(loadDebts);
const Reports = lazy(loadReports);
const Settings = lazy(loadSettings);

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center px-6">
    <div className="text-center">
      <p className="text-sm font-semibold text-text-muted">Memuat halaman...</p>
    </div>
  </div>
);

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    localStorage.setItem("theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  useEffect(() => {
    // Warm up secondary route chunks after initial UI becomes idle.
    const prefetchRoutes = () => {
      loadTransactions();
      loadAssets();
      loadDebts();
      loadReports();
      loadSettings();
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchRoutes, {
        timeout: 2000,
      });
      return () => {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(prefetchRoutes, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <Router>
      <div className="w-full h-full transition-colors duration-300">
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard theme={theme} />} />
              <Route
                path="/transactions"
                element={<Transactions theme={theme} />}
              />
              <Route path="/assets" element={<Assets theme={theme} />} />
              <Route path="/debts" element={<Debts theme={theme} />} />
              <Route path="/reports" element={<Reports theme={theme} />} />
              <Route path="/settings" element={<Settings theme={theme} />} />
            </Routes>
          </Suspense>
        </Layout>
      </div>
    </Router>
  );
}

export default App;
