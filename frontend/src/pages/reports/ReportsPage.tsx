import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Search,
  RotateCcw,
  MoreHorizontal,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { reportsService, teamsService, projectsService, membersService } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import { PageHeader, QueryState } from '../pageUtils';
import type { Report, ReportScope } from '@/types';

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ReportsPage() {
  const queryClient = useQueryClient();

  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'PDF' | 'CSV'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sheet State
  const [isGenerateSheetOpen, setIsGenerateSheetOpen] = useState(false);
  const [newReportScope, setNewReportScope] = useState<ReportScope>('ORGANIZATION');
  const [newReportFormat, setNewReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [newReportTitle, setNewReportTitle] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Query reports with auto-polling when any report is processing or pending
  const reportsQuery = useQuery({
    queryKey: queryKeys.reports.all(),
    queryFn: () => reportsService.getAll(),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasInProgress = data?.reports?.some(
        (r: Report) => r.status === 'PENDING' || r.status === 'PROCESSING'
      );
      return hasInProgress ? 2500 : false;
    },
  });

  // Query helper entities for sheet dropdowns
  const { data: teams = [] } = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
    enabled: isGenerateSheetOpen && newReportScope === 'TEAM',
  });

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
    enabled: isGenerateSheetOpen && newReportScope === 'PROJECT',
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersService.getAll(),
    enabled: isGenerateSheetOpen && newReportScope === 'DEVELOPER',
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => reportsService.create(payload, newReportFormat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      setIsGenerateSheetOpen(false);
      setSheetError(null);
      setNewReportTitle('');
      toast.success('Report generation initiated', {
        description: `Export queued as ${newReportFormat.toUpperCase()}. It will download once ready.`,
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to generate report';
      const formatted = Array.isArray(msg) ? msg.join(', ') : msg;
      setSheetError(formatted);
      toast.error('Failed to start report generation', { description: formatted });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      toast.success('Report deleted successfully');
    },
    onError: (err: any) => {
      toast.error('Failed to delete report', {
        description: err?.message || 'Please try again later',
      });
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => reportsService.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      toast.info('Report retry triggered');
    },
  });

  const reportsList = reportsQuery.data?.reports ?? [];

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reportsList.filter((r: Report) => {
      // Scope filter
      if (scopeFilter !== 'ALL') {
        const reportScope = (r.scope || 'ORGANIZATION').toUpperCase();
        if (reportScope !== scopeFilter) return false;
      }

      // Format filter
      if (formatFilter !== 'ALL') {
        const reportType = (r.type || 'PDF').toUpperCase();
        if (reportType !== formatFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = r.title?.toLowerCase().includes(q);
        const filenameMatch = r.filename?.toLowerCase().includes(q);
        if (!titleMatch && !filenameMatch) return false;
      }

      return true;
    });
  }, [reportsList, scopeFilter, formatFilter, searchQuery]);

  // Handle browser file download
  const handleDownload = async (report: Report) => {
    try {
      setDownloadingId(report.id);
      const blob = await reportsService.download(report.id);
      const mimeType = report.type === 'CSV' ? 'text/csv' : 'application/pdf';
      const fileBlob = new Blob([blob], { type: mimeType });
      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      const ext = (report.type || 'PDF').toLowerCase();
      const filename = report.filename || `${report.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (e: any) {
      console.error('Failed to download report', e);
      toast.error('Failed to download report', {
        description: e?.message || 'File artifact not available',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this report?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Report ID copied to clipboard');
  };

  // Open sheet and seed defaults
  const openGenerateSheet = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setDateRange({
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    });
    setNewReportScope('ORGANIZATION');
    setNewReportFormat('pdf');
    setNewReportTitle('Monthly Executive Quality Report');
    setSelectedTeamId('');
    setSelectedProjectId('');
    setSelectedDeveloperId('');
    setSheetError(null);
    setIsGenerateSheetOpen(true);
  };

  const handleScopeChange = (scope: ReportScope) => {
    setNewReportScope(scope);
    switch (scope) {
      case 'ORGANIZATION':
        setNewReportTitle('Monthly Executive Quality Report');
        break;
      case 'TEAM':
        setNewReportTitle('Team Engineering Performance Report');
        break;
      case 'PROJECT':
        setNewReportTitle('Project System Quality Report');
        break;
      case 'DEVELOPER':
        setNewReportTitle('Developer Quality Score (DQS) Report');
        break;
    }
  };

  // Submit report generation
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setSheetError(null);

    if (!newReportTitle.trim()) {
      setSheetError('Report title is required');
      return;
    }

    if (!dateRange.start || !dateRange.end) {
      setSheetError('Start and end dates are required');
      return;
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    if (endDate <= startDate) {
      setSheetError('End date must be strictly after start date');
      return;
    }

    if (newReportScope === 'TEAM' && !selectedTeamId) {
      setSheetError('Please select a team for team-scoped reports');
      return;
    }

    if (newReportScope === 'PROJECT' && !selectedProjectId) {
      setSheetError('Please select a project for project-scoped reports');
      return;
    }

    if (newReportScope === 'DEVELOPER' && !selectedDeveloperId) {
      setSheetError('Please select a developer for developer-scoped reports');
      return;
    }

    const payload: any = {
      title: newReportTitle.trim(),
      scope: newReportScope,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    if (newReportScope === 'TEAM') payload.teamId = selectedTeamId;
    if (newReportScope === 'PROJECT') payload.projectId = selectedProjectId;
    if (newReportScope === 'DEVELOPER') payload.developerId = selectedDeveloperId;

    createMutation.mutate(payload);
  };

  const getScopeDescription = (scope: ReportScope) => {
    switch (scope) {
      case 'ORGANIZATION':
        return 'High-level executive summary of organizational engineering health, velocity, and quality scores.';
      case 'TEAM':
        return 'Detailed team-level velocity metrics, code quality trends, and pull request turnaround.';
      case 'PROJECT':
        return 'Repository health, test coverage benchmarks, and system quality scores (SQS).';
      case 'DEVELOPER':
        return 'Developer quality metrics (DQS), contribution volume, and review activity breakdown.';
    }
  };

  const scopeTabs = [
    { value: 'ALL', label: 'All Scopes' },
    { value: 'ORGANIZATION', label: 'Organization' },
    { value: 'TEAM', label: 'Team' },
    { value: 'PROJECT', label: 'Project' },
    { value: 'DEVELOPER', label: 'Developer' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Engineering Reports"
        description="Audit, monitor, and export executive quality summaries, DQS telemetry, and sprint velocity."
        action={
          <Button onClick={openGenerateSheet} className="gap-2 shadow-xs cursor-pointer">
            <Plus className="h-4 w-4 shrink-0" /> New Report
          </Button>
        }
      />

      {/* Unified Enterprise Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card border border-border rounded-xl p-2.5 shadow-xs">
        {/* Left: Search Bar & Scope Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by report title or file..."
              className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>

          {/* Scope Filters */}
          <div className="inline-flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/40 h-9">
            {scopeTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setScopeFilter(tab.value)}
                className={`h-8 px-2.5 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                  scopeFilter === tab.value
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Format Pills, Counter & Actions */}
        <div className="flex items-center gap-2 justify-between lg:justify-end">
          <div className="inline-flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/40 h-9">
            {(['ALL', 'PDF', 'CSV'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormatFilter(fmt)}
                className={`h-8 px-2.5 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                  formatFilter === fmt
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono tabular-nums text-muted-foreground px-2">
            {filteredReports.length} {filteredReports.length === 1 ? 'record' : 'records'}
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => reportsQuery.refetch()}
            disabled={reportsQuery.isFetching}
            className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reportsQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* High-Density Data Table */}
      <QueryState isLoading={reportsQuery.isLoading} error={reportsQuery.error} onRetry={() => reportsQuery.refetch()}>
        <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="h-10 hover:bg-transparent">
                <TableHead className="w-[340px]">Report Name</TableHead>
                <TableHead className="w-[130px]">Scope</TableHead>
                <TableHead className="w-[190px]">Period</TableHead>
                <TableHead className="w-[90px]">Size</TableHead>
                <TableHead className="w-[130px]">Created</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report: Report) => {
                const isCompleted = report.status === 'COMPLETED';
                const isProcessing = report.status === 'PROCESSING' || report.status === 'PENDING';
                const isFailed = report.status === 'FAILED';
                const isPdf = (report.type || 'PDF').toUpperCase() === 'PDF';

                return (
                  <TableRow key={report.id} className="group">
                    {/* Report Name & Type Icon */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                            isPdf
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60'
                          }`}
                        >
                          {isPdf ? (
                            <FileText className="h-3.5 w-3.5" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span
                            className="font-medium text-foreground hover:underline cursor-pointer truncate block text-xs"
                            title={report.title}
                            onClick={() => isCompleted && handleDownload(report)}
                          >
                            {report.title}
                          </span>
                          {report.filename && (
                            <span className="text-[11px] font-mono text-muted-foreground truncate block">
                              {report.filename}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Scope Badge */}
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-muted/60 text-muted-foreground border border-border/50">
                        {report.scope || 'ORGANIZATION'}
                      </span>
                    </TableCell>

                    {/* Period */}
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {report.startDate
                        ? `${new Date(report.startDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })} – ${new Date(report.endDate || '').toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : 'Last 30 Days'}
                    </TableCell>

                    {/* Size */}
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {report.fileSize ? formatBytes(report.fileSize) : '—'}
                    </TableCell>

                    {/* Created */}
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      )}
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Compiling
                        </span>
                      )}
                      {isFailed && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          title={report.errorMessage || 'Generation error'}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Failed
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isCompleted && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => handleDownload(report)}
                            disabled={downloadingId === report.id}
                            title={`Download ${report.type || 'PDF'}`}
                          >
                            {downloadingId === report.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}

                        {isFailed && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700 cursor-pointer"
                            onClick={() => retryMutation.mutate(report.id)}
                            disabled={retryMutation.isPending}
                            title="Retry compilation"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isCompleted && (
                              <DropdownMenuItem onClick={() => handleDownload(report)}>
                                <Download className="h-3.5 w-3.5 mr-2" /> Download file
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleCopyId(report.id)}>
                              <Copy className="h-3.5 w-3.5 mr-2" /> Copy report ID
                            </DropdownMenuItem>
                            {isFailed && (
                              <DropdownMenuItem onClick={() => retryMutation.mutate(report.id)}>
                                <RotateCcw className="h-3.5 w-3.5 mr-2" /> Retry generation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(report.id)}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete report
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredReports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-xs font-medium text-foreground">No reports found</p>
                      <p className="text-[11px] text-muted-foreground max-w-sm">
                        {scopeFilter === 'ALL' && formatFilter === 'ALL' && !searchQuery
                          ? 'Generate your first executive report to begin auditing quality telemetry.'
                          : 'No generated reports match your current filter parameters.'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openGenerateSheet}
                        className="mt-2 gap-1.5 text-xs cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> New Report
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </QueryState>

      {/* Slide-Over Drawer (Sheet) for Report Generation */}
      <Sheet open={isGenerateSheetOpen} onOpenChange={setIsGenerateSheetOpen}>
        <SheetContent side="right" className="flex flex-col h-full w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Generate Engineering Report</SheetTitle>
            <SheetDescription>
              Compile automated quality metrics, DQS benchmarks, and velocity telemetry.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleGenerate} className="flex-1 flex flex-col justify-between overflow-y-auto pt-4 space-y-4">
            <div className="space-y-4">
              {sheetError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sheetError}</span>
                </div>
              )}

              {/* Title */}
              <Input
                label="Report Title"
                value={newReportTitle}
                onChange={(e) => setNewReportTitle(e.target.value)}
                placeholder="e.g. Monthly Executive Quality Report"
                required
                autoFocus
              />

              {/* Scope & Format Custom Selects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Report Scope</label>
                  <Select
                    value={newReportScope}
                    onValueChange={(val) => handleScopeChange(val as ReportScope)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORGANIZATION">Organization-Wide</SelectItem>
                      <SelectItem value="TEAM">Team Specific</SelectItem>
                      <SelectItem value="PROJECT">Project Specific</SelectItem>
                      <SelectItem value="DEVELOPER">Developer Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Export Format</label>
                  <Select
                    value={newReportFormat}
                    onValueChange={(val) => setNewReportFormat(val as 'pdf' | 'csv')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document (.pdf)</SelectItem>
                      <SelectItem value="csv">CSV Spreadsheet (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional Entity Selectors */}
              {newReportScope === 'TEAM' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Select Team</label>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newReportScope === 'PROJECT' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Select Project</label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newReportScope === 'DEVELOPER' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Select Developer</label>
                  <Select value={selectedDeveloperId} onValueChange={setSelectedDeveloperId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a developer" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => (
                        <SelectItem key={m.user.id} value={m.user.id}>
                          {m.user.name || m.user.email} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date Ranges */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  required
                />
              </div>

              {/* Scope Detail Callout */}
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3.5 space-y-1 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Scope Parameters
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {getScopeDescription(newReportScope)}
                </p>
              </div>
            </div>

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsGenerateSheetOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={createMutation.isPending}
                className="gap-2 font-medium cursor-pointer shadow-xs"
              >
                <FileText className="h-4 w-4 shrink-0" />
                Compile {newReportFormat.toUpperCase()}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
