import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Assets from "./pages/Assets";
import Debts from "./pages/Debts";
import Reports from "./pages/Reports";

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <Router>
      <div className="w-full h-full transition-colors duration-300">
        <Layout theme={theme} toggleTheme={toggleTheme}>
          <Routes>
            <Route path="/" element={<Dashboard theme={theme} />} />
            <Route
              path="/transactions"
              element={<Transactions theme={theme} />}
            />
            <Route path="/assets" element={<Assets theme={theme} />} />
            <Route path="/debts" element={<Debts theme={theme} />} />
            <Route path="/reports" element={<Reports theme={theme} />} />
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}

export default App;
