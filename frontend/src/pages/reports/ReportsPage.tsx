import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Shield,
  Users,
  Layers,
  Plus,
  Calendar,
  Clock,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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

  // Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [newReportScope, setNewReportScope] = useState<ReportScope>('ORGANIZATION');
  const [newReportFormat, setNewReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [newReportTitle, setNewReportTitle] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedDeveloperId, setSelectedDeveloperId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [modalError, setModalError] = useState<string | null>(null);

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

  // Query helper entities for modal dropdowns
  const { data: teams = [] } = useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: () => teamsService.getAll(),
    enabled: isGenerateModalOpen && newReportScope === 'TEAM',
  });

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projectsService.getAll(),
    enabled: isGenerateModalOpen && newReportScope === 'PROJECT',
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersService.getAll(),
    enabled: isGenerateModalOpen && newReportScope === 'DEVELOPER',
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => reportsService.create(payload, newReportFormat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
      setIsGenerateModalOpen(false);
      setModalError(null);
      setNewReportTitle('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to generate report';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => reportsService.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all() });
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

  // Handle actual browser download of file
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
      a.download = report.filename || `${report.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Failed to download report', e);
      alert('Failed to download report: ' + (e?.message || 'File not ready'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this report?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRetry = (id: string) => {
    retryMutation.mutate(id);
  };

  // Open modal and seed defaults
  const openGenerateModal = () => {
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
    setModalError(null);
    setIsGenerateModalOpen(true);
  };

  const handleScopeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scope = e.target.value as ReportScope;
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
    setModalError(null);

    if (!newReportTitle.trim()) {
      setModalError('Report title is required');
      return;
    }

    if (!dateRange.start || !dateRange.end) {
      setModalError('Start and end dates are required');
      return;
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    if (endDate <= startDate) {
      setModalError('End date must be strictly after start date');
      return;
    }

    if (newReportScope === 'TEAM' && !selectedTeamId) {
      setModalError('Please select a team for team-scoped reports');
      return;
    }

    if (newReportScope === 'PROJECT' && !selectedProjectId) {
      setModalError('Please select a project for project-scoped reports');
      return;
    }

    if (newReportScope === 'DEVELOPER' && !selectedDeveloperId) {
      setModalError('Please select a developer for developer-scoped reports');
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

  const getScopeIcon = (scope?: string) => {
    switch (scope) {
      case 'ORGANIZATION':
        return <Shield className="h-5 w-5 text-indigo-500" />;
      case 'TEAM':
        return <Users className="h-5 w-5 text-blue-500" />;
      case 'PROJECT':
        return <Layers className="h-5 w-5 text-emerald-500" />;
      case 'DEVELOPER':
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <FileText className="h-5 w-5 text-slate-500" />;
    }
  };

  const getScopeDescription = (scope: ReportScope) => {
    switch (scope) {
      case 'ORGANIZATION':
        return 'High-level executive summary of organization engineering health, velocity, and quality scores.';
      case 'TEAM':
        return 'Detailed team-level velocity metrics, code quality trends, and pull request turnaround.';
      case 'PROJECT':
        return 'Repository health, test coverage benchmarks, and system quality scores (SQS).';
      case 'DEVELOPER':
        return 'Developer quality metrics (DQS), contribution volume, and review activity breakdown.';
    }
  };

  const scopeTabs = [
    { value: 'ALL', label: 'All Reports' },
    { value: 'ORGANIZATION', label: 'Organization' },
    { value: 'TEAM', label: 'Team' },
    { value: 'PROJECT', label: 'Project' },
    { value: 'DEVELOPER', label: 'Developer' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Reports"
        description="Generate, view, and export executive quality reports, DQS analytics, and velocity metrics."
        action={
          <Button onClick={openGenerateModal} className="gap-2 shadow-sm cursor-pointer">
            <Plus className="h-4 w-4" /> Generate Report
          </Button>
        }
      />

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-blue-100 dark:border-blue-900 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/60 p-2.5 rounded-xl">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Asynchronous Background Report Generator Active
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                PDF and CSV compilation jobs run worker-side with automated progress tracking and instant download.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={openGenerateModal}
            className="shrink-0 bg-white dark:bg-slate-800 text-xs sm:text-sm cursor-pointer"
          >
            Create New Export
          </Button>
        </CardContent>
      </Card>

      {/* Controls Bar: Scope Tabs, Format Toggle, and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <Tabs value={scopeFilter} onValueChange={setScopeFilter} className="w-full md:w-auto">
          <TabsList className="w-full md:w-auto flex overflow-x-auto justify-start">
            {scopeTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-w-fit cursor-pointer text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
          {/* Format pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg text-xs">
            {(['ALL', 'PDF', 'CSV'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormatFilter(fmt)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  formatFilter === fmt
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <QueryState isLoading={reportsQuery.isLoading} error={reportsQuery.error} onRetry={() => reportsQuery.refetch()}>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredReports.map((report: Report) => {
            const scope = report.scope || 'ORGANIZATION';
            const isCompleted = report.status === 'COMPLETED';
            const isProcessing = report.status === 'PROCESSING' || report.status === 'PENDING';
            const isFailed = report.status === 'FAILED';

            return (
              <Card
                key={report.id}
                className="flex h-full flex-col justify-between group hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl shrink-0">
                        {getScopeIcon(scope)}
                      </div>
                      <div className="space-y-1">
                        <CardTitle
                          className="text-base font-semibold line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                          title={report.title}
                        >
                          {report.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-xs text-slate-500">
                          {report.description || getScopeDescription(scope as ReportScope)}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="py-0 flex-1 space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-3 space-y-2 text-xs border border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Format & Scope</span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold tracking-wider ${
                            report.type === 'CSV'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800'
                          }`}
                        >
                          {report.type}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800">
                          {scope}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Period
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {report.startDate
                          ? `${new Date(report.startDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })} - ${new Date(report.endDate || '').toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}`
                          : 'Last 30 Days'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Status
                      </span>
                      <div>
                        {isCompleted && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                            <CheckCircle className="h-3.5 w-3.5" /> Ready ({formatBytes(report.fileSize)})
                          </span>
                        )}
                        {isProcessing && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium text-xs animate-pulse">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating...
                          </span>
                        )}
                        {isFailed && (
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium text-xs">
                            <AlertTriangle className="h-3.5 w-3.5" /> Generation Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {isFailed && report.errorMessage && (
                      <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-[11px] text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                        {report.errorMessage}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400">Created</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 cursor-pointer"
                      onClick={() => handleDelete(report.id)}
                      title="Delete Report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    {isFailed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(report.id)}
                        disabled={retryMutation.isPending}
                        className="gap-1.5 text-xs text-amber-600 hover:text-amber-700 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(report)}
                        disabled={!isCompleted || downloadingId === report.id}
                        className="gap-1.5 text-xs cursor-pointer"
                      >
                        {downloadingId === report.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {downloadingId === report.id
                          ? 'Downloading...'
                          : `Download ${report.type || 'PDF'}`}
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}

          {filteredReports.length === 0 && (
            <div className="col-span-full">
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No Reports Found</h3>
                  <p className="mt-1 text-sm text-slate-500 max-w-sm">
                    {scopeFilter === 'ALL' && formatFilter === 'ALL' && !searchQuery
                      ? "You haven't generated any reports yet."
                      : 'No reports match your current filter and search criteria.'}
                  </p>
                  <Button onClick={openGenerateModal} className="mt-6 gap-2 cursor-pointer" variant="outline">
                    <Plus className="h-4 w-4" /> Generate Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </QueryState>

      {/* Generate Report Modal */}
      <Modal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} title="Generate New Report">
        <form onSubmit={handleGenerate} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}

          <Input
            label="Report Title"
            value={newReportTitle}
            onChange={(e) => setNewReportTitle(e.target.value)}
            placeholder="e.g. Monthly Executive Quality Report"
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Report Scope
              </label>
              <select
                value={newReportScope}
                onChange={handleScopeChange}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ORGANIZATION">Organization-Wide</option>
                <option value="TEAM">Team Specific</option>
                <option value="PROJECT">Project Specific</option>
                <option value="DEVELOPER">Developer Specific</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Export Format
              </label>
              <select
                value={newReportFormat}
                onChange={(e) => setNewReportFormat(e.target.value as 'pdf' | 'csv')}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="pdf">PDF Document (Formatted with charts)</option>
                <option value="csv">CSV Spreadsheet (Raw metric data)</option>
              </select>
            </div>
          </div>

          {/* Conditional Scope Selector */}
          {newReportScope === 'TEAM' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                required
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Choose a Team --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newReportScope === 'PROJECT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Choose a Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newReportScope === 'DEVELOPER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Developer
              </label>
              <select
                value={selectedDeveloperId}
                onChange={(e) => setSelectedDeveloperId(e.target.value)}
                required
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Choose a Developer --</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name || m.user.email} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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

          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg flex items-start gap-3 mt-4 text-xs">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-200">Report Scope Contents</p>
              <p className="text-blue-700 dark:text-blue-300 mt-0.5">{getScopeDescription(newReportScope)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGenerateModalOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> Generate {newReportFormat.toUpperCase()}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
