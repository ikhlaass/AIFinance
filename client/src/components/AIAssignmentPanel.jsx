import React, { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RotateCw,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const toRp = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace("IDR", "Rp");

const AIAssignmentPanel = () => {
  const [isAutoAssignEnabled, setIsAutoAssignEnabled] = useState(true);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    avgConfidence: 0,
    successCount: 0,
  });

  // Fetch assignment logs on mount
  useEffect(() => {
    fetchAssignmentLogs();
  }, []);

  const fetchAssignmentLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch("/api/ai/assignment-logs?limit=10");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);

        // Calculate stats
        const total = data.logs.length;
        const avgConfidence =
          total > 0
            ? (data.logs.reduce(
                (sum, log) => sum + Number(log.confidence || 0),
                0,
              ) /
                total) *
              100
            : 0;
        const successCount = data.logs.filter(
          (log) => Number(log.confidence || 0) >= 0.75,
        ).length;

        setStats({
          total,
          avgConfidence: avgConfidence.toFixed(0),
          successCount,
        });
      }
    } catch (err) {
      console.error("Failed to fetch assignment logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleToggleAutoAssign = () => {
    setIsAutoAssignEnabled(!isAutoAssignEnabled);
    // TODO: Persist preference via API /api/settings/ai-preferences
  };

  const getMethodBadge = (method) => {
    const badges = {
      deterministic_single_wallet: {
        label: "Single Wallet",
        color: "bg-blue-100 text-blue-800",
        icon: "⚡",
      },
      deterministic_scored: {
        label: "Scored",
        color: "bg-green-100 text-green-800",
        icon: "📊",
      },
      llm_fallback: {
        label: "LLM Fallback",
        color: "bg-purple-100 text-purple-800",
        icon: "🤖",
      },
      manual_override: {
        label: "Manual",
        color: "bg-orange-100 text-orange-800",
        icon: "✋",
      },
      pending_review: {
        label: "Pending",
        color: "bg-yellow-100 text-yellow-800",
        icon: "⏳",
      },
    };
    return (
      badges[method] || {
        label: method,
        color: "bg-gray-100 text-gray-800",
        icon: "?",
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            AI Assignment Control
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage automatic wallet assignment for Telegram transactions
          </p>
        </div>
      </div>

      {/* Auto-Assign Toggle */}
      <div className="bg-card card-gradient rounded-xl border border-card-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Auto-Assign Mode</h3>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, AI will automatically assign wallets to transactions
              from Telegram if confidence is high enough.
            </p>
          </div>
          <button
            onClick={handleToggleAutoAssign}
            className={cn(
              "relative inline-flex h-8 w-16 items-center rounded-full transition-colors",
              isAutoAssignEnabled ? "bg-green-500" : "bg-gray-300",
            )}
          >
            <span
              className={cn(
                "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
                isAutoAssignEnabled ? "translate-x-9" : "translate-x-1",
              )}
            />
          </button>
        </div>

        {/* Mode Info */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Current Mode:</strong>{" "}
            {isAutoAssignEnabled
              ? "✓ Auto-Assign Enabled"
              : "✗ Manual Review Only"}
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-2">
            {isAutoAssignEnabled
              ? "Transactions with confidence ≥75% will be auto-assigned. Others go to review queue."
              : "All AI decisions will be stored as pending, requiring manual confirmation."}
          </p>
        </div>
      </div>

      {/* Statistics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card card-gradient rounded-xl border border-card-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Assignments</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats.total}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card card-gradient rounded-xl border border-card-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Confidence</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats.successCount}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card card-gradient rounded-xl border border-card-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Confidence</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats.avgConfidence}%
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Recent Assignment Logs */}
      <div className="bg-card card-gradient rounded-xl border border-card-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-lg">
            Recent Assignments
          </h3>
          <button
            onClick={fetchAssignmentLogs}
            disabled={isLoadingLogs}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <RotateCw
              className={cn("w-4 h-4", isLoadingLogs && "animate-spin")}
            />
            Refresh
          </button>
        </div>

        {isLoadingLogs && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Loading logs...</p>
          </div>
        )}

        {!isLoadingLogs && logs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No assignment logs yet. Transactions from Telegram will appear here.
          </div>
        )}

        {!isLoadingLogs && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => {
              const badge = getMethodBadge(log.method);
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className="border border-card-border rounded-lg overflow-hidden hover:bg-card/50 transition-colors"
                >
                  {/* Summary Row */}
                  <button
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-accent/50"
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          badge.color,
                        )}
                      >
                        {badge.icon} {badge.label}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">
                          {log.type === "expense" ? "Pengeluaran" : "Pemasukan"}{" "}
                          {toRp(log.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {(Number(log.confidence) * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {/* Details Row */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-accent/30 border-t border-card-border space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">
                            Category
                          </p>
                          <p className="font-medium text-foreground">
                            {log.category}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">
                            Wallet
                          </p>
                          <p className="font-medium text-foreground">
                            ID: {log.chosenWalletId}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground uppercase">
                            Reason
                          </p>
                          <p className="font-medium text-foreground">
                            {log.reason}
                          </p>
                        </div>
                      </div>

                      {log.candidates && log.candidates.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground uppercase mb-2">
                            Candidates Scored
                          </p>
                          <div className="space-y-1">
                            {log.candidates.slice(0, 3).map((c, idx) => (
                              <div
                                key={idx}
                                className="text-xs flex justify-between"
                              >
                                <span className="text-foreground">
                                  {c.name}
                                </span>
                                <span className="text-muted-foreground">
                                  {(Number(c.confidence) * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-accent/20 rounded-xl border border-accent/50 p-4">
        <p className="text-sm text-foreground">
          <strong>💡 How it works:</strong> When you send a transaction via
          Telegram, the AI analyzes it and scores available wallets. If the
          confidence is high (≥75%), it's auto-assigned. Otherwise, it waits for
          your manual review.
        </p>
      </div>
    </div>
  );
};

export default AIAssignmentPanel;
