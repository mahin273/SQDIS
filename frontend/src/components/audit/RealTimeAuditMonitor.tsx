import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Radio,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Send,
  Terminal,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { useRealTimeAuditEvents } from '@/hooks/useRealTimeAuditEvents';
import { auditService } from '@/services/audit.service';
import type { AuditLog } from '@/types';

export function RealTimeAuditMonitor() {
  const { realtimeLogs, isConnected, clearRealtimeLogs } = useRealTimeAuditEvents();

  const [combinedLogs, setCombinedLogs] = useState<AuditLog[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [pausedBufferCount, setPausedBufferCount] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [isTriggeringTest, setIsTriggeringTest] = useState(false);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  // Initial load of recent 50 audit logs from REST API
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isRefetching,
  } = useQuery({
    queryKey: ['audit-logs', 'realtime-monitor-history'],
    queryFn: () => auditService.queryLogs({ pageSize: 50, sortOrder: 'desc' }),
    staleTime: 60 * 1000,
  });

  // Seed combined logs with initial history once available
  useEffect(() => {
    if (historyData?.data && combinedLogs.length === 0) {
      setCombinedLogs(historyData.data);
    }
  }, [historyData, combinedLogs.length]);

  // When new realtime logs arrive via WebSocket
  useEffect(() => {
    if (realtimeLogs.length === 0) return;

    const latestLiveLog = realtimeLogs[0];
    if (!latestLiveLog) return;

    if (isPaused) {
      setPausedBufferCount((prev) => prev + 1);
      return;
    }

    setLiveIds((prev) => new Set([...prev, latestLiveLog.id]));

    setCombinedLogs((prev) => {
      // Deduplicate by ID
      if (prev.some((item) => item.id === latestLiveLog.id)) {
        return prev;
      }
      return [latestLiveLog, ...prev.slice(0, 199)];
    });
  }, [realtimeLogs, isPaused]);

  // Handle stream pause / resume
  const togglePause = () => {
    if (isPaused) {
      // Resuming: flush newest realtime logs into combined view
      if (realtimeLogs.length > 0) {
        setCombinedLogs((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const newEntries = realtimeLogs.filter((l) => !existingIds.has(l.id));
          newEntries.forEach((l) => setLiveIds((s) => new Set([...s, l.id])));
          return [...newEntries, ...prev].slice(0, 200);
        });
      }
      setPausedBufferCount(0);
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  // Trigger test audit event to immediately verify streaming
  const handleTriggerTestEvent = async () => {
    try {
      setIsTriggeringTest(true);
      setTestNotification(null);
      const res = await auditService.triggerTestEvent('REALTIME_MONITOR_PING', 'LOW');
      setTestNotification(`✓ Test event dispatched: ${res.action}`);
      setTimeout(() => setTestNotification(null), 4000);
    } catch (err: any) {
      setTestNotification(`✗ Failed to dispatch test: ${err.message}`);
      setTimeout(() => setTestNotification(null), 5000);
    } finally {
      setIsTriggeringTest(false);
    }
  };

  // Clear displayed stream buffer
  const handleClear = () => {
    setCombinedLogs([]);
    setLiveIds(new Set());
    setPausedBufferCount(0);
    clearRealtimeLogs();
  };

  // Filtered logs based on search query and severity
  const filteredLogs = useMemo(() => {
    return combinedLogs.filter((log) => {
      if (severityFilter !== 'ALL') {
        if ((log.severity || 'LOW').toUpperCase() !== severityFilter) {
          return false;
        }
      }

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const actionMatch = log.action?.toLowerCase().includes(q);
      const resourceMatch = log.resourceType?.toLowerCase().includes(q);
      const actorMatch =
        log.user?.email?.toLowerCase().includes(q) ||
        log.user?.name?.toLowerCase().includes(q) ||
        log.userId?.toLowerCase().includes(q);

      return actionMatch || resourceMatch || actorMatch;
    });
  }, [combinedLogs, severityFilter, searchQuery]);

  return (
    <div className="space-y-4 p-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-50">Real-Time Audit Monitor</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Live stream of security events & system audit logs over Socket.IO (/audit-events)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-300">
              {isConnected ? 'LIVE STREAM CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <button
            onClick={handleTriggerTestEvent}
            disabled={isTriggeringTest || !isConnected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors shadow-sm cursor-pointer"
            title="Dispatch a real-time test event into the stream"
          >
            {isTriggeringTest ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Emit Test Event
          </button>
        </div>
      </div>

      {/* Test Notification Banner */}
      {testNotification && (
        <div className="p-2.5 px-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <span>{testNotification}</span>
        </div>
      )}

      {/* Controls Bar: Filters & Stream Toggles */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action, resource, actor..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-slate-700 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            {filteredLogs.length} events
          </span>

          <button
            onClick={togglePause}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
              isPaused
                ? 'bg-amber-950/40 border-amber-800 text-amber-300 hover:bg-amber-900/50'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3" />}
            {isPaused ? `Resume (${pausedBufferCount} buffered)` : 'Pause'}
          </button>

          <button
            onClick={() => refetchHistory()}
            disabled={isRefetching}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
            title="Reload latest audit logs from server"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 border border-slate-700 text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
            title="Clear current stream feed"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {/* Pause Notification Warning */}
      {isPaused && (
        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Stream is paused. {pausedBufferCount} new incoming events waiting in buffer.
          </span>
          <button
            onClick={togglePause}
            className="font-semibold underline hover:text-amber-200 cursor-pointer"
          >
            Resume Live Stream
          </button>
        </div>
      )}

      {/* Main Terminal Feed Window */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 shadow-inner">
        <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
          {isHistoryLoading && combinedLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-sans space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
              <p>Hydrating latest audit logs from server...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans space-y-3">
              <Terminal className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-slate-400 font-medium">No matching audit events</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No events match your current filter criteria, or the event stream is idle.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleTriggerTestEvent}
                  disabled={isTriggeringTest || !isConnected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs cursor-pointer"
                >
                  <Send className="w-3 h-3 text-emerald-400" />
                  Emit a Test Ping Event
                </button>
              </div>
            </div>
          ) : (
            filteredLogs.map((event) => {
              const isLive = liveIds.has(event.id);
              const isExpanded = expandedLogId === event.id;
              const severity = (event.severity || 'LOW').toUpperCase();

              return (
                <div
                  key={event.id || `${event.action}-${event.timestamp}`}
                  className={`p-3.5 transition-all hover:bg-slate-900/60 cursor-pointer ${
                    isLive ? 'bg-emerald-950/20 border-l-2 border-emerald-500' : ''
                  }`}
                  onClick={() => setExpandedLogId(isExpanded ? null : event.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLive && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold tracking-wider animate-pulse">
                            <Radio className="w-2.5 h-2.5" /> LIVE
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
                            severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : severity === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : severity === 'MEDIUM'
                              ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {severity}
                        </span>

                        <span className="font-semibold text-slate-100 break-words">
                          {event.action}
                        </span>

                        <span className="text-slate-500 text-[11px]">on</span>

                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                          {event.resourceType || 'System'}
                          {event.resourceId ? ` (#${event.resourceId.slice(0, 8)})` : ''}
                        </span>
                      </div>

                      <div className="text-slate-400 text-[11px] flex items-center gap-3 flex-wrap">
                        <span>
                          Actor:{' '}
                          <span className="text-slate-300">
                            {event.user?.email || event.user?.name || event.userId || 'System'}
                          </span>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>
                          IP: <span className="text-slate-400">{event.ipAddress || '127.0.0.1'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                      <span className="text-slate-400">
                        {new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Collapsible Details Drawer */}
                  {isExpanded && (
                    <div
                      className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono bg-slate-950/80 p-3 rounded border border-slate-900 animate-fadeIn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 text-[11px]">
                        <div>
                          <span className="text-slate-500">Event ID:</span>{' '}
                          <span className="text-slate-300">{event.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Timestamp:</span>{' '}
                          <span className="text-slate-300">
                            {new Date(event.timestamp).toISOString()}
                          </span>
                        </div>
                        {event.granted !== undefined && (
                          <div>
                            <span className="text-slate-500">Access Granted:</span>{' '}
                            <span
                              className={event.granted ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}
                            >
                              {event.granted ? 'TRUE' : 'FALSE'}
                            </span>
                          </div>
                        )}
                        {event.requiredRole && (
                          <div>
                            <span className="text-slate-500">Required Role:</span>{' '}
                            <span className="text-amber-400">{event.requiredRole}</span>
                          </div>
                        )}
                        {event.userRole && (
                          <div>
                            <span className="text-slate-500">User Role:</span>{' '}
                            <span className="text-slate-300">{event.userRole}</span>
                          </div>
                        )}
                      </div>

                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-slate-500 text-[11px] block">Metadata:</span>
                          <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 text-[11px] overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
