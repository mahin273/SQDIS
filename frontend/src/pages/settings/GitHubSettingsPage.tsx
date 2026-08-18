import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Github, RefreshCw, CheckCircle2, AlertTriangle, Link2, 
  Activity, Shield, Webhook, Clock, Info, Check, X,
  Terminal, Search, ExternalLink, Key, Eye, EyeOff, Copy, CheckCheck, Trash2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { githubService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { QueryState } from '../pageUtils'

import type { WebhookLogEntry } from '@/types'

const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo,read:org,admin:repo_hook,read:user&description=SQDIS%20Quality%20Integration'

export function GitHubSettingsPage() {
  const queryClient = useQueryClient()
  const [searchLogs, setSearchLogs] = useState('')
  
  // Modals state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false)
  const [patInput, setPatInput] = useState('')
  const [showPat, setShowPat] = useState(false)
  const [copiedPayload, setCopiedPayload] = useState(false)
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    scopes?: string[]
    message?: string
  } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: queryKeys.github.status,
    queryFn: () => githubService.getStatus(),
  })

  const status = statusQuery.data
  const isConnected = status?.isConnected ?? status?.connected ?? false

  const webhookLogsQuery = useQuery({
    queryKey: ['github-webhook-logs'],
    queryFn: () => githubService.getWebhookLogs(),
    enabled: isConnected,
  })

  // Mutations
  const connectMutation = useMutation({
    mutationFn: (pat: string) => githubService.connect({ pat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.github.status })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
      queryClient.invalidateQueries({ queryKey: ['github-webhook-logs'] })
      setIsConnectModalOpen(false)
      setPatInput('')
      setValidationResult(null)
      setConnectError(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to connect GitHub. Please verify your token.'
      setConnectError(msg)
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => githubService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.github.status })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
      queryClient.invalidateQueries({ queryKey: ['github-webhook-logs'] })
      setIsDisconnectModalOpen(false)
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => githubService.syncRepositories(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.github.status })
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
      queryClient.invalidateQueries({ queryKey: ['github-webhook-logs'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => githubService.retryWebhookDelivery(deliveryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-webhook-logs'] })
    },
  })

  const handleValidatePat = async () => {
    if (!patInput.trim()) return
    setIsValidating(true)
    setValidationResult(null)
    setConnectError(null)
    try {
      const result = await githubService.validatePAT(patInput.trim())
      setValidationResult(result)
    } catch (err: any) {
      setValidationResult({
        valid: false,
        message: err?.response?.data?.message || 'Failed to validate token with GitHub API',
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!patInput.trim()) return
    connectMutation.mutate(patInput.trim())
  }

  const payloadUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/github/webhook` 
    : 'https://api.sqdis.dev/api/github/webhook'

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadUrl)
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  const activeScopes = status?.scopes || []
  const scopes = [
    { name: 'repo', description: 'Full control of private repositories', required: true },
    { name: 'read:org', description: 'Read organization and team membership', required: true },
    { name: 'admin:repo_hook', description: 'Full control of repository hooks', required: true },
    { name: 'read:user', description: 'Read all user profile data', required: false },
    { name: 'workflow', description: 'Update GitHub Action workflows', required: false },
  ]

  const rawLogs = webhookLogsQuery.data
  const webhookLogs: WebhookLogEntry[] = Array.isArray(rawLogs)
    ? rawLogs
    : (rawLogs && typeof rawLogs === 'object' && Array.isArray((rawLogs as any).data))
    ? (rawLogs as any).data
    : (rawLogs && typeof rawLogs === 'object' && Array.isArray((rawLogs as any).logs))
    ? (rawLogs as any).logs
    : []

  const filteredLogs = webhookLogs.filter(log => 
    (log.eventType || '').toLowerCase().includes(searchLogs.toLowerCase()) || 
    (log.deliveryId || '').toLowerCase().includes(searchLogs.toLowerCase()) ||
    (log.repositoryId || '').toLowerCase().includes(searchLogs.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <QueryState isLoading={statusQuery.isLoading} error={statusQuery.error} onRetry={() => statusQuery.refetch()}>
        
        {/* Main Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Github className="h-6 w-6 text-slate-900 dark:text-white" /> 
                  GitHub Integration
                </CardTitle>
                <CardDescription className="mt-2">
                  Connect your GitHub Organization or Personal Account to sync commit history, pull request reviews, and automated webhook events.
                </CardDescription>
              </div>
              <Badge variant={isConnected ? 'success' : 'destructive'} className="gap-1 px-3 py-1 text-sm">
                {isConnected ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Connected Account</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {status?.username || (isConnected ? 'Active Organization PAT' : 'Not connected')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Enabled Repositories</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {status?.enabledRepositoriesCount ?? 0} active
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Connection Date</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sync Status</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          Healthy
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
                          </span>
                          Inactive
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 justify-center md:border-l md:border-slate-200 dark:md:border-slate-800 md:pl-6">
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={!isConnected || syncMutation.isPending}
                  className="gap-2 w-full justify-start"
                >
                  <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} /> 
                  {syncMutation.isPending ? 'Syncing...' : 'Trigger Repository Sync'}
                </Button>
                
                {!isConnected ? (
                  <Button 
                    onClick={() => {
                      setPatInput('')
                      setValidationResult(null)
                      setConnectError(null)
                      setIsConnectModalOpen(true)
                    }}
                    variant="default" 
                    className="gap-2 w-full justify-start bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    <Link2 className="h-4 w-4" /> Connect GitHub App
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setIsDisconnectModalOpen(true)}
                    variant="outline" 
                    className="gap-2 w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
                  >
                    <Trash2 className="h-4 w-4" /> Disconnect Integration
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scopes & Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" /> 
                OAuth Scopes & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scopes.map((scope) => {
                  const isGranted = isConnected && (
                    activeScopes.includes(scope.name) ||
                    activeScopes.some(s => s.startsWith(scope.name + ':')) ||
                    (scope.name === 'read:org' && activeScopes.includes('admin:org')) ||
                    (scope.name === 'read:repo_hook' && activeScopes.includes('admin:repo_hook'))
                  )

                  return (
                    <div key={scope.name} className="flex items-start justify-between p-3 rounded-md bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            {scope.name}
                          </code>
                          {scope.required && (
                            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Required</span>
                          )}
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400 mt-1">{scope.description}</span>
                      </div>
                      {isGranted ? (
                        <Badge variant="success" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100">Granted</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {isConnected ? 'Missing' : 'Not Connected'}
                        </Badge>
                      )}
                    </div>
                  )
                })}
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 rounded-md text-sm">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>Required scopes are used to clone and inspect repository quality metrics, listen to webhook events, and map author identity across commits.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-purple-500" /> 
                Webhook Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Payload URL</label>
                  <div className="flex mt-1.5">
                    <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-l-md border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                      {payloadUrl}
                    </code>
                    <Button 
                      variant="outline" 
                      onClick={handleCopyPayload}
                      className="rounded-l-none border-l-0 gap-1.5 min-w-[90px]"
                    >
                      {copiedPayload ? (
                        <>
                          <CheckCheck className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">SQDIS automatically registers this URL on your enabled GitHub repositories.</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Webhook HMAC Secret</label>
                  <div className="flex mt-1.5">
                    <Input type="password" value="••••••••••••••••••••••••••••••••" readOnly className="rounded-r-none font-mono text-sm" />
                    <Button 
                      variant="outline" 
                      onClick={() => syncMutation.mutate()}
                      isLoading={syncMutation.isPending}
                      className="rounded-l-none border-l-0 text-xs"
                    >
                      Refresh
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Used by SQDIS to verify that incoming webhook requests are genuinely signed by GitHub.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-medium mb-3">Subscribed Events</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Push', 'Pull Request', 'Pull Request Review', 'Issue Comment', 'Repository'].map(event => (
                      <Badge key={event} variant="outline" className="bg-slate-50 dark:bg-slate-900">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Webhook Events Log */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" /> 
                Recent Webhook Deliveries
              </CardTitle>
              <CardDescription>View live events sent by GitHub to your webhook URL.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search deliveries..." 
                className="pl-9"
                value={searchLogs}
                onChange={(e) => setSearchLogs(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Event Type</th>
                      <th className="px-4 py-3 font-medium">Delivery ID</th>
                      <th className="px-4 py-3 font-medium">Response / Info</th>
                      <th className="px-4 py-3 font-medium text-right">Time</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3">
                          {log.status === 'SUCCESS' ? (
                            <Badge variant="success" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1 px-1.5 py-0.5">
                              <Check className="h-3 w-3" /> 200 OK
                            </Badge>
                          ) : log.status === 'PENDING' ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1 px-1.5 py-0.5">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Pending
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200 gap-1 px-1.5 py-0.5">
                              <X className="h-3 w-3" /> Error
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-400">
                            {log.eventType}
                          </code>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{log.deliveryId ? log.deliveryId.slice(0, 12) + '...' : 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[200px]">
                          {log.responseTimeMs ? `${log.responseTimeMs}ms` : (log.errorMessage || 'Delivered')}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap text-xs">
                          <div className="flex justify-end items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.status === 'FAILED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                              onClick={() => retryMutation.mutate(log.deliveryId)}
                              isLoading={retryMutation.isPending}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {webhookLogsQuery.isLoading ? 'Loading webhook deliveries...' : 'No webhook events recorded yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => webhookLogsQuery.refetch()}
                isLoading={webhookLogsQuery.isFetching}
                className="gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh Delivery Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </QueryState>

      {/* Connect GitHub PAT Modal */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <Github className="h-6 w-6 text-slate-900 dark:text-white" />
            <span>Connect GitHub Integration</span>
          </div>
        }
        description="Link your GitHub account using a Personal Access Token to synchronize your repositories, track quality metrics, and configure webhook telemetry."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsConnectModalOpen(false)}
              disabled={connectMutation.isPending}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={handleValidatePat}
                disabled={!patInput.trim() || isValidating || connectMutation.isPending}
                className="gap-1.5"
              >
                {isValidating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {isValidating ? 'Validating...' : 'Test Token'}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleConnectSubmit}
                isLoading={connectMutation.isPending}
                disabled={!patInput.trim()}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Link2 className="h-4 w-4" /> Connect GitHub
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleConnectSubmit} className="space-y-5">
          {/* Quick instructions & generate token button */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Generate a GitHub Personal Access Token</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Click the button below to generate a pre-configured token on GitHub with all required scopes selected.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 text-xs font-semibold gap-1.5"
              >
                <a href={GITHUB_TOKEN_URL} target="_blank" rel="noopener noreferrer">
                  Generate on GitHub <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
            
            <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/60">
              <span className="text-[11px] font-medium text-blue-800 dark:text-blue-300">Required scopes:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['repo', 'read:org', 'admin:repo_hook', 'read:user'].map((scope) => (
                  <code key={scope} className="text-[11px] font-mono bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
                    {scope}
                  </code>
                ))}
              </div>
            </div>
          </div>

          {/* Token input field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="h-4 w-4 text-slate-500" />
                Personal Access Token (PAT)
              </span>
              <span className="text-xs text-slate-500">Classic or Fine-Grained</span>
            </label>
            
            <div className="relative">
              <Input
                type={showPat ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={patInput}
                onChange={(e) => {
                  setPatInput(e.target.value)
                  setValidationResult(null)
                  setConnectError(null)
                }}
                className="pr-10 font-mono text-sm"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPat(!showPat)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Validation Feedback */}
          {validationResult && (
            <div className={`p-3.5 rounded-lg border text-sm flex items-start gap-2.5 ${
              validationResult.valid 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
            }`}>
              {validationResult.valid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {validationResult.valid ? 'Token is Valid!' : 'Token Validation Failed'}
                </p>
                <p className="text-xs">
                  {validationResult.valid 
                    ? 'All required scopes were detected. Ready to connect!' 
                    : (validationResult.message || 'The token is missing required scopes. Please ensure repo, read:org, and admin:repo_hook are granted.')}
                </p>
                {validationResult.scopes && validationResult.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {validationResult.scopes.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-mono bg-white dark:bg-slate-900">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {connectError && (
            <div className="p-3.5 rounded-lg border bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Connection Error</p>
                <p className="text-xs mt-0.5">{connectError}</p>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        title="Disconnect GitHub Integration"
        message="Are you sure you want to disconnect GitHub? This will remove all repository webhooks, stop telemetry syncing, and unmap active repositories for this workspace."
        confirmText="Disconnect Integration"
        variant="danger"
        isLoading={disconnectMutation.isPending}
        onConfirm={() => disconnectMutation.mutate()}
      />
    </div>
  )
}
