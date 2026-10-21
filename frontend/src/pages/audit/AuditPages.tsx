import { Link } from 'react-router-dom';
import { Radio, ShieldCheck, Activity, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AuditLogQuery, AuditAnalyticsDashboard, RealTimeAuditMonitor } from '@/components/audit';

interface AuditHeaderProps {
  activeTab: 'monitor' | 'query' | 'analytics';
}

function AuditHeader({ activeTab }: AuditHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Sleek Top Header Toolbar (Zero Hero Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Security & Audit Telemetry Studio
                </h1>
                <Badge variant="outline" className="font-mono text-[11px] text-emerald-600 border-emerald-500/30">
                  Tamper-Evident Ledger
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cryptographic immutable audit trail, live WebSocket event stream, and compliance intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Tabbed Navigation Strip */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium">
          <Link
            to="/audit-logs/monitor"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'monitor'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${activeTab === 'monitor' ? 'text-emerald-500 animate-pulse' : ''}`} />
            Live Monitor
          </Link>

          <Link
            to="/audit-logs/explorer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'query'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Log Explorer
          </Link>

          <Link
            to="/audit-logs/analytics"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Security Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AuditLogsPage() {
  return (
    <div className="w-full max-w-none space-y-6">
      <AuditHeader activeTab="query" />
      <AuditLogQuery />
    </div>
  );
}

export function AuditAnalyticsPage() {
  return (
    <div className="w-full max-w-none space-y-6">
      <AuditHeader activeTab="analytics" />
      <AuditAnalyticsDashboard />
    </div>
  );
}

export function RealTimeAuditMonitorPage() {
  return (
    <div className="w-full max-w-none space-y-6">
      <AuditHeader activeTab="monitor" />
      <RealTimeAuditMonitor />
    </div>
  );
}
