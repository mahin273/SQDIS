import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ShieldAlert, Code2, Flame, Search, Layers, Clock, Activity, Download, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Pagination } from '@/components/ui/pagination'
import { debtService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { PageHeader, MetricTile, QueryState } from '../pageUtils'
import type { DebtItem, DebtHotspot } from '@/types'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

export function DebtPage() {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15

  const debtQuery = useQuery({
    queryKey: queryKeys.debt.all({ 
      page,
      pageSize
    }),
    queryFn: () => debtService.getAll({ 
      page,
      pageSize
    }),
  })

  const hotspotsQuery = useQuery({
    queryKey: queryKeys.debt.hotspots(),
    queryFn: () => debtService.getHotspots(),
  })

  const trendsQuery = useQuery({
    queryKey: queryKeys.debt.trends({ days: 30 }),
    queryFn: () => debtService.getTrends(30),
  })

  const trendData = useMemo(() => {
    const rawData = trendsQuery.data
    const points = Array.isArray(rawData?.data)
      ? rawData.data
      : Array.isArray((rawData as any)?.points)
      ? (rawData as any).points
      : []

    if (!points || points.length === 0) return []

    return points.map((p: any) => {
      const d = new Date(p.date)
      return {
        date: isNaN(d.getTime())
          ? p.date || ''
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        debt: Number(p.totalDebt ?? p.debt ?? p.netDebt ?? 0),
        added: Number(p.addedDebt ?? p.newDebt ?? 0),
        resolved: Number(p.resolvedDebt ?? 0),
      }
    })
  }, [trendsQuery.data])

  const responseData = debtQuery.data
  const items: DebtItem[] = Array.isArray(responseData)
    ? responseData
    : (responseData && typeof responseData === 'object' && Array.isArray((responseData as any).data))
    ? (responseData as any).data
    : []
  const rawHotspots = hotspotsQuery.data
  const hotspots: DebtHotspot[] = Array.isArray(rawHotspots)
    ? rawHotspots
    : (rawHotspots && typeof rawHotspots === 'object' && Array.isArray((rawHotspots as any).data))
    ? (rawHotspots as any).data
    : []
  
  // Client-side search and severity filtering
  const filteredItems = useMemo(() => {
    let result = items
    if (severityFilter !== 'ALL') {
      result = result.filter((i) => i.severity === severityFilter)
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      result = result.filter((i) => 
        i.title?.toLowerCase().includes(lowerQuery) ||
        i.type?.toLowerCase().includes(lowerQuery) ||
        i.modulePath?.toLowerCase().includes(lowerQuery)
      )
    }
    return result
  }, [items, severityFilter, searchQuery])

  const highSeverityCount = items.filter((i) => i.severity === 'HIGH' || i.severity === 'CRITICAL').length
  const totalEffort = items.reduce((sum, item) => sum + (item.effortMinutes || 0), 0)
  const totalEffortHours = Math.round(totalEffort / 60)

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="bg-rose-500 hover:bg-rose-600 border-rose-500 shadow-sm">{severity}</Badge>
      case 'HIGH':
        return <Badge className="bg-orange-500 hover:bg-orange-600 border-orange-500 text-white shadow-sm">{severity}</Badge>
      case 'MEDIUM':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">{severity}</Badge>
      case 'LOW':
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">{severity}</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  const getHeatColor = (complexity: number) => {
    if (complexity > 80) return 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
    if (complexity > 50) return 'text-orange-500 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900'
    return 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technical Debt & Hotspots"
        description="Identify architectural bottlenecks, complex modules, code smells, and technical debt accumulation."
        action={
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile 
          label="Total Debt Items" 
          value={responseData?.total || items.length} 
          icon={<AlertTriangle className="h-5 w-5" />} 
          helper="Across all repositories"
        />
        <MetricTile 
          label="High / Critical" 
          value={highSeverityCount} 
          icon={<ShieldAlert className="h-5 w-5 text-rose-500" />} 
          helper="Requires immediate attention"
        />
        <MetricTile 
          label="Active Hotspots" 
          value={hotspots.length} 
          icon={<Flame className="h-5 w-5 text-orange-500" />} 
          helper="Files with high churn + complexity"
        />
        <MetricTile 
          label="Est. Remediation" 
          value={`${totalEffortHours}h`} 
          icon={<Clock className="h-5 w-5 text-blue-500" />} 
          helper="Based on current page items"
        />
      </div>

      <QueryState isLoading={debtQuery.isLoading} error={debtQuery.error} onRetry={() => debtQuery.refetch()}>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-indigo-500" /> Technical Debt Inventory
                </CardTitle>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search modules or issues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />}
                    className="h-9"
                  />
                </div>
              </div>

              <Tabs value={severityFilter} onValueChange={setSeverityFilter} className="mt-4">
                <TabsList>
                  <TabsTrigger value="ALL">All Items</TabsTrigger>
                  <TabsTrigger value="CRITICAL">Critical</TabsTrigger>
                  <TabsTrigger value="HIGH">High</TabsTrigger>
                  <TabsTrigger value="MEDIUM">Medium</TabsTrigger>
                  <TabsTrigger value="LOW">Low</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 mt-2 pt-2">
                {filteredItems.map((item: DebtItem) => (
                  <div key={item.id} className="py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-6 px-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getSeverityBadge(item.severity)}
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{item.title || item.type}</h4>
                        </div>
                        
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {item.description || 'Code complexity issue that increases maintenance cost and risk of defects.'}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                          {item.modulePath && (
                            <div className="flex items-center gap-1 font-mono">
                              <Layers className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate max-w-[200px]" title={item.modulePath}>{item.modulePath}</span>
                            </div>
                          )}
                          {item.repository && (
                            <div className="flex items-center gap-1">
                              <Code2 className="h-3.5 w-3.5 text-slate-400" />
                              <span>{item.repository.name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2">
                        {item.effortMinutes !== undefined && (
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {item.effortMinutes < 60 ? `${item.effortMinutes}m` : `${(item.effortMinutes / 60).toFixed(1)}h`}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">Est. Effort</span>
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredItems.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <Code2 className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No Debt Items</h3>
                    <p className="text-slate-500 mt-1 max-w-sm">
                      {searchQuery 
                        ? `No items found matching "${searchQuery}"`
                        : "No technical debt items found matching the current filters."}
                    </p>
                  </div>
                )}
              </div>

              {responseData && (
                <Pagination
                  currentPage={page}
                  totalPages={responseData.totalPages || Math.ceil((responseData.total || items.length) / pageSize) || 1}
                  onPageChange={setPage}
                  className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4"
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" /> Refactoring Hotspots
                </CardTitle>
                <CardDescription>Files with high complexity and frequent changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-6">
                  {hotspots.map((hotspot: DebtHotspot) => {
                    const complexity = hotspot.complexity || hotspot.severityScore || 50;
                    const colorClasses = getHeatColor(complexity);
                    
                    return (
                      <div key={`${hotspot.repositoryId}-${hotspot.filePath}`} className="px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate pr-2 max-w-[200px]" title={hotspot.filePath}>
                            {hotspot.filePath || 'Core module'}
                          </p>
                          <Badge variant="outline" className={`text-[10px] h-5 ${colorClasses}`}>
                            HOT
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-medium text-slate-500">
                            <span>Complexity Score</span>
                            <span>{complexity} / 100</span>
                          </div>
                          <Progress 
                            value={complexity} 
                            className="h-1.5" 
                            indicatorClassName={complexity > 80 ? 'bg-rose-500' : complexity > 50 ? 'bg-orange-500' : 'bg-amber-500'} 
                          />
                        </div>
                      </div>
                    )
                  })}
                  
                  {hotspots.length === 0 && (
                    <div className="py-8 px-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">No active hotspots flagged.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-rose-500" /> Debt Accumulation Trend
                  </CardTitle>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    30 Days
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Net technical debt trajectory over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[180px] w-full flex items-center justify-center">
                  {trendsQuery.isLoading ? (
                    <div className="text-xs text-slate-500">Loading trend trajectory...</div>
                  ) : trendData.length === 0 || trendData.every((p: { debt: number; added: number }) => p.debt === 0 && p.added === 0) ? (
                    <div className="text-center p-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Zero Debt Backlog
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No technical debt accumulation detected in the selected period.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          allowDecimals={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#f8fafc',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="debt"
                          name="Debt Score"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorDebt)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </QueryState>
    </div>
  )
}
