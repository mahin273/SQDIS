import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, History, RefreshCw } from 'lucide-react';
import { auditService } from '@/services/audit.service';
import type { AuditLog, AuditLogFilters, AuditExport } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

export function AuditLogQuery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: 20,
  });
  const [search, setSearch] = useState('');
  const [isExportsModalOpen, setIsExportsModalOpen] = useState(false);
  const [downloadingExportId, setDownloadingExportId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => auditService.queryLogs(filters),
  });

  const exportsQuery = useQuery({
    queryKey: ['auditLogExports'],
    queryFn: () => auditService.listExports(),
    enabled: isExportsModalOpen,
  });

  const exportMutation = useMutation({
    mutationFn: (format: 'CSV' | 'JSON') => auditService.exportLogs({ format }),
    onSuccess: (_, format) => {
      queryClient.invalidateQueries({ queryKey: ['auditLogExports'] });
      toast(`Export to ${format} initiated successfully. Check Export History to download.`, { type: 'success' });
    },
    onError: (err: any) => {
      toast(err?.response?.data?.message || err?.message || 'Failed to initiate audit log export', { type: 'error' });
    },
  });

  const handleDownloadExport = async (item: AuditExport) => {
    try {
      setDownloadingExportId(item.id);
      const blob = await auditService.downloadExport(item.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${item.id}.${item.format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast('Export downloaded successfully', { type: 'success' });
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Failed to download export file', { type: 'error' });
    } finally {
      setDownloadingExportId(null);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <Input
          placeholder="Filter by action, user, or resource..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => exportMutation.mutate('CSV')}
            disabled={exportMutation.isPending}
            variant="outline"
            size="sm"
            className="gap-1.5 border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            CSV
          </Button>
          <Button
            onClick={() => exportMutation.mutate('JSON')}
            disabled={exportMutation.isPending}
            variant="outline"
            size="sm"
            className="gap-1.5 border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <FileText className="h-4 w-4 text-blue-400" />
            JSON
          </Button>
          <Button
            onClick={() => setIsExportsModalOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <History className="h-4 w-4 text-indigo-400" />
            History
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="gap-1.5 border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading audit records...</div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-400">Failed to load audit records.</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No audit logs found matching criteria.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            <div className="grid grid-cols-12 gap-4 p-3 bg-slate-950/60 font-semibold text-xs text-slate-400 uppercase tracking-wider">
              <div className="col-span-3">Timestamp</div>
              <div className="col-span-3">Actor</div>
              <div className="col-span-3">Action</div>
              <div className="col-span-3">Resource</div>
            </div>
            {data.data.map((log: AuditLog) => (
              <div key={log.id} className="grid grid-cols-12 gap-4 p-3 text-xs text-slate-300 hover:bg-slate-800/40 transition-colors">
                <div className="col-span-3 font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</div>
                <div className="col-span-3 font-medium text-slate-200">{log.user?.email || log.userId || 'System'}</div>
                <div className="col-span-3">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                    {log.action}
                  </span>
                </div>
                <div className="col-span-3 text-slate-400 truncate">{log.resourceId || log.resourceType}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isExportsModalOpen}
        onClose={() => setIsExportsModalOpen(false)}
        title="Audit Log Export History"
        description="View and download generated immutable ledger exports."
        size="lg"
      >
        <div className="space-y-4 py-2">
          {exportsQuery.isLoading ? (
            <div className="p-6 text-center text-slate-400 text-xs">Loading exports...</div>
          ) : !exportsQuery.data || exportsQuery.data.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">No export records found.</div>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
              {exportsQuery.data.map((exp: AuditExport) => (
                <div key={exp.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/60 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {exp.format}
                      </Badge>
                      <Badge
                        variant={exp.status === 'COMPLETED' ? 'success' : exp.status === 'FAILED' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {exp.status}
                      </Badge>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {exp.estimatedRecords ?? 0} records
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Generated at {new Date(exp.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {exp.status === 'COMPLETED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs border-slate-700"
                      disabled={downloadingExportId === exp.id}
                      onClick={() => handleDownloadExport(exp)}
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-400" />
                      {downloadingExportId === exp.id ? 'Downloading...' : 'Download'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
