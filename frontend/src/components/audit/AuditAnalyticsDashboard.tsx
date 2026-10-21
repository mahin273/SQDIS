import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Activity,
  Users,
  AlertTriangle,
  Layers,
  RefreshCw,
  Clock,
  ArrowRight,
  TrendingUp,
  Server,
  Lock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Link } from 'react-router-dom';
import { auditService } from '@/services/audit.service';

type TimeRange = '24h' | '7d' | '30d' | '90d';

export function AuditAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Compute start/end dates
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (timeRange === '24h') start.setHours(start.getHours() - 24);
    else if (timeRange === '7d') start.setDate(start.getDate() - 7);
    else if (timeRange === '30d') start.setDate(start.getDate() - 30);
    else if (timeRange === '90d') start.setDate(start.getDate() - 90);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [timeRange]);

  // Queries
  const {
    data: rawActionCounts,
    isLoading: loadingCounts,
    refetch: refetchCounts,
  } = useQuery({
    queryKey: ['auditAnalyticsActionCounts', startDate, endDate],
    queryFn: () => auditService.getActionCounts(startDate, endDate),
  });

  const {
    data: rawActiveUsers,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['auditAnalyticsActiveUsers', startDate, endDate],
    queryFn: () => auditService.getActiveUsers(startDate, endDate, 10),
  });

  const {
    data: rawFailedPermissions,
    isLoading: loadingFailed,
    refetch: refetchFailed,
  } = useQuery({
    queryKey: ['auditAnalyticsFailedPermissions', startDate, endDate],
    queryFn: () => auditService.getFailedPermissions(startDate, endDate),
  });

  const {
    data: rawTimeline,
    isLoading: loadingTimeline,
    refetch: refetchTimeline,
  } = useQuery({
    queryKey: ['auditAnalyticsTimeline', startDate, endDate, timeRange],
    queryFn: () =>
      auditService.getActionTimeline(
        startDate,
        endDate,
        timeRange === '24h' ? 'hour' : 'day'
      ),
  });

  const {
    data: rawTopResources,
    isLoading: loadingResources,
    refetch: refetchResources,
  } = useQuery({
    queryKey: ['auditAnalyticsTopResources', startDate, endDate],
    queryFn: () => auditService.getTopResources(startDate, endDate, 8),
  });

  const refetchAll = () => {
    refetchCounts();
    refetchUsers();
    refetchFailed();
    refetchTimeline();
    refetchResources();
  };

  // Normalized Action Counts
  const actionCounts = useMemo<{ action: string; count: number }[]>(() => {
    if (!rawActionCounts) return [];
    if (Array.isArray(rawActionCounts)) {
      return rawActionCounts.map((item: any) => ({
        action: item.action || item._id || 'UNKNOWN',
        count: Number(item.count || 0),
      }));
    }
    if (typeof rawActionCounts === 'object') {
      return Object.entries(rawActionCounts).map(([action, count]) => ({
        action,
        count: Number(count) || 0,
      }));
    }
    return [];
  }, [rawActionCounts]);

  // Total Actions
  const totalActions = useMemo(() => {
    return actionCounts.reduce((acc, curr) => acc + curr.count, 0);
  }, [actionCounts]);

  // Normalized Active Users
  const activeUsers = useMemo<{ userId: string; name: string; count: number; lastActive?: string }[]>(() => {
    if (!rawActiveUsers || !Array.isArray(rawActiveUsers)) return [];
    return rawActiveUsers.map((item: any) => ({
      userId: item.userId || item.id || 'N/A',
      name: item.userName || item.name || item.email || item.userId || 'Unknown User',
      count: Number(item.actionCount || item.count || 0),
      lastActive: item.lastActivity || item.lastActive,
    }));
  }, [rawActiveUsers]);

  // Normalized Failed Permissions
  const failedPermissions = useMemo<any[]>(() => {
    if (!rawFailedPermissions || !Array.isArray(rawFailedPermissions)) return [];
    return rawFailedPermissions.map((item: any) => ({
      userId: item.userId || 'N/A',
      userName: item.userName || item.name || 'Unknown User',
      failedAttempts: Number(item.failedAttempts || item.count || 0),
      mostCommonAction: item.mostCommonAction || item.resource || 'UNAUTHORIZED_ACCESS',
      lastAttempt: item.lastAttempt,
    }));
  }, [rawFailedPermissions]);

  const totalFailedAttempts = useMemo(() => {
    return failedPermissions.reduce((acc, curr) => acc + curr.failedAttempts, 0);
  }, [failedPermissions]);

  // Normalized Timeline
  const timelineData = useMemo(() => {
    if (!rawTimeline || !Array.isArray(rawTimeline) || rawTimeline.length === 0) {
      return [];
    }
    return rawTimeline.map((point: any) => {
      const date = new Date(point.timestamp);
      const label =
        timeRange === '24h'
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return {
        label,
        count: Number(point.actionCount || point.count || 0),
      };
    });
  }, [rawTimeline, timeRange]);

  // Normalized Top Resources
  const topResources = useMemo(() => {
    if (!rawTopResources || !Array.isArray(rawTopResources)) return [];
    return rawTopResources.map((item: any) => ({
      resourceType: item.resourceType || item.resource || 'Entity',
      resourceId: item.resourceId || 'N/A',
      accessCount: Number(item.accessCount || item.count || 0),
      uniqueUsers: Number(item.uniqueUsers || 1),
    }));
  }, [rawTopResources]);

  const isLoadingAny =
    loadingCounts || loadingUsers || loadingFailed || loadingTimeline || loadingResources;

  return (
    <div className="space-y-6">
      {/* Header Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Audit Intelligence & Security Overview
            </h2>
            <p className="text-xs text-slate-400">
              Real-time monitoring and historical telemetry across organizational boundaries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Time Range Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  timeRange === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={refetchAll}
            disabled={isLoadingAny}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition-colors disabled:opacity-50"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingAny ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Operations */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Audit Events
              </p>
              <h3 className="text-2xl font-bold text-slate-100">
                {loadingCounts ? (
                  <span className="inline-block w-16 h-7 bg-slate-800 animate-pulse rounded" />
                ) : (
                  totalActions.toLocaleString()
                )}
              </h3>
            </div>
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Recorded in the last {timeRange}
          </p>
        </div>

        {/* Active Operators */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Active Operators
              </p>
              <h3 className="text-2xl font-bold text-slate-100">
                {loadingUsers ? (
                  <span className="inline-block w-12 h-7 bg-slate-800 animate-pulse rounded" />
                ) : (
                  activeUsers.length.toLocaleString()
                )}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Unique authorized actors
          </p>
        </div>

        {/* Failed Permission Checks */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Access Denials
              </p>
              <h3
                className={`text-2xl font-bold ${
                  totalFailedAttempts > 0 ? 'text-amber-400' : 'text-slate-100'
                }`}
              >
                {loadingFailed ? (
                  <span className="inline-block w-12 h-7 bg-slate-800 animate-pulse rounded" />
                ) : (
                  totalFailedAttempts.toLocaleString()
                )}
              </h3>
            </div>
            <div
              className={`p-2 rounded-lg border ${
                totalFailedAttempts > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Unauthorized or blocked actions
          </p>
        </div>

        {/* Resources Monitored */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Target Entities
              </p>
              <h3 className="text-2xl font-bold text-slate-100">
                {loadingResources ? (
                  <span className="inline-block w-12 h-7 bg-slate-800 animate-pulse rounded" />
                ) : (
                  topResources.length.toLocaleString()
                )}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <Server className="h-3 w-3" /> Critical resources accessed
          </p>
        </div>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Operation Frequency Timeline
              </h3>
              <p className="text-xs text-slate-400">
                Audit volume velocity over selected timeframe
              </p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {timeRange.toUpperCase()}
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            {loadingTimeline ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Loading timeline telemetry...
              </div>
            ) : timelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Activity className="h-8 w-8 text-slate-600" />
                <p className="text-xs">No audit timeline recorded in this window.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="auditAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Audit Events"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#auditAreaGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Action Type Distribution */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-slate-100">
                Action Distribution
              </h3>
              <span className="text-xs text-slate-400">{actionCounts.length} types</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Breakdown of operations by security action
            </p>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {loadingCounts ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  Loading action distribution...
                </div>
              ) : actionCounts.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  No action events found.
                </div>
              ) : (
                actionCounts.map((item) => {
                  const percentage =
                    totalActions > 0 ? Math.round((item.count / totalActions) * 100) : 0;
                  return (
                    <div key={item.action} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono font-medium text-slate-300 truncate max-w-[180px]">
                          {item.action}
                        </span>
                        <span className="text-slate-400 font-semibold">
                          {item.count}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({percentage}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <Link
              to="/audit-logs/monitor"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <span>View Raw Audit Log Stream</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Most Active Users & Top Target Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Active Operators */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Most Active Operators
              </h3>
              <p className="text-xs text-slate-400">
                Identities with highest event output
              </p>
            </div>
            <Users className="h-4 w-4 text-slate-400" />
          </div>

          <div className="space-y-2">
            {loadingUsers ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                Loading operator statistics...
              </div>
            ) : activeUsers.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                No active operator telemetry recorded.
              </div>
            ) : (
              activeUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-2.5 bg-slate-950/50 border border-slate-800/70 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="h-7 w-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-medium text-slate-200 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        ID: {user.userId}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded font-semibold text-xs">
                      {user.count} actions
                    </span>
                    {user.lastActive && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(user.lastActive).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Monitored Resources */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Top Targeted Resources
              </h3>
              <p className="text-xs text-slate-400">
                Entities with highest mutation frequency
              </p>
            </div>
            <Server className="h-4 w-4 text-slate-400" />
          </div>

          <div className="space-y-2">
            {loadingResources ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                Loading resource statistics...
              </div>
            ) : topResources.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                No targeted resource telemetry recorded.
              </div>
            ) : (
              topResources.map((res, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-950/50 border border-slate-800/70 rounded-lg text-xs"
                >
                  <div className="overflow-hidden">
                    <span className="inline-block px-1.5 py-0.5 bg-slate-800 text-slate-300 font-mono text-[10px] rounded mr-2">
                      {res.resourceType}
                    </span>
                    <span className="font-mono text-slate-300 text-xs truncate">
                      {res.resourceId}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-slate-400 text-xs">
                      {res.uniqueUsers} {res.uniqueUsers === 1 ? 'user' : 'users'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded font-semibold text-xs">
                      {res.accessCount} ops
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
