import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Bell, Mail, Smartphone, Slack, Save, 
  CheckCircle2, AlertTriangle, Clock, ShieldAlert,
  Volume2, VolumeX, Layers, Radio, RefreshCw, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { alertsService } from '@/services'
import type { AlertSeverity, AlertPreference, UpdatePreferenceRequest } from '@/types'

export function NotificationSettings() {
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Query actual preferences from database
  const { data: preferences, isLoading, isError, refetch } = useQuery<AlertPreference>({
    queryKey: ['notification-preferences'],
    queryFn: () => alertsService.getPreferences(),
  })

  // Local form state
  const [formData, setFormData] = useState<{
    emailEnabled: boolean
    inAppEnabled: boolean
    slackEnabled: boolean
    slackWebhookUrl: string
    quietHoursEnabled: boolean
    quietStart: string
    quietEnd: string
    digestMode: boolean
    digestFrequency: 'hourly' | 'daily' | 'weekly'
    minSeverity: AlertSeverity
  }>({
    emailEnabled: true,
    inAppEnabled: true,
    slackEnabled: false,
    slackWebhookUrl: '',
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    digestMode: false,
    digestFrequency: 'daily',
    minSeverity: 'MEDIUM',
  })

  // Synchronize form data when preferences query resolves
  useEffect(() => {
    if (preferences) {
      setFormData({
        emailEnabled: preferences.emailEnabled ?? true,
        inAppEnabled: preferences.inAppEnabled ?? true,
        slackEnabled: preferences.slackEnabled ?? false,
        slackWebhookUrl: preferences.slackWebhookUrl || '',
        quietHoursEnabled: Boolean(preferences.quietStart && preferences.quietEnd),
        quietStart: preferences.quietStart || '22:00',
        quietEnd: preferences.quietEnd || '07:00',
        digestMode: preferences.digestMode ?? false,
        digestFrequency: (['hourly', 'daily', 'weekly'].includes(String(preferences.digestFrequency).toLowerCase())
          ? String(preferences.digestFrequency).toLowerCase()
          : 'daily') as 'hourly' | 'daily' | 'weekly',
        minSeverity: preferences.minSeverity || 'MEDIUM',
      })
    }
  }, [preferences])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdatePreferenceRequest) => alertsService.updatePreferences(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated)
      setSuccessMessage('Notification preferences updated and saved to database.')
      setErrorMessage(null)
      setTimeout(() => setSuccessMessage(null), 4000)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update preferences.'
      setErrorMessage(msg)
      setSuccessMessage(null)
      setTimeout(() => setErrorMessage(null), 5000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)
    setErrorMessage(null)

    const payload: UpdatePreferenceRequest = {
      emailEnabled: formData.emailEnabled,
      inAppEnabled: formData.inAppEnabled,
      slackEnabled: formData.slackEnabled,
      slackWebhookUrl: formData.slackEnabled && formData.slackWebhookUrl.trim() 
        ? formData.slackWebhookUrl.trim() 
        : undefined,
      quietStart: formData.quietHoursEnabled ? formData.quietStart : undefined,
      quietEnd: formData.quietHoursEnabled ? formData.quietEnd : undefined,
      digestMode: formData.digestMode,
      digestFrequency: formData.digestFrequency,
      minSeverity: formData.minSeverity,
    }

    updateMutation.mutate(payload)
  }

  const severityOptions: { value: AlertSeverity; label: string; desc: string; color: string }[] = [
    {
      value: 'LOW',
      label: 'All Telemetry (Low+)',
      desc: 'All quality variations, code churn alerts, and routine status events.',
      color: 'border-slate-300 dark:border-slate-700',
    },
    {
      value: 'MEDIUM',
      label: 'Balanced (Medium+)',
      desc: 'SQS score drops below 70, new technical debt items, and failed quality gates.',
      color: 'border-blue-300 dark:border-blue-700',
    },
    {
      value: 'HIGH',
      label: 'High Urgency (High+)',
      desc: 'Critical quality gate blocks, SQS drops below 50, and acute code hotspot risks.',
      color: 'border-amber-300 dark:border-amber-700',
    },
    {
      value: 'CRITICAL',
      label: 'Critical Only',
      desc: 'System-wide outages, failed release canaries, and severe vulnerability risks.',
      color: 'border-red-300 dark:border-red-700',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading notification preferences from database...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
        <h3 className="text-base font-semibold text-red-900 dark:text-red-200">Unable to load notification preferences</h3>
        <p className="text-sm text-red-700 dark:text-red-400">Could not retrieve your stored preferences from the server.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Feedback Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-800 dark:text-red-300 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Global Notification Channels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Delivery Channels</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Select destination platforms for real-time engineering quality alerts.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Database-Backed</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* In-App Notifications */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">In-App Alerts</p>
                <p className="text-xs text-slate-500">Display live alert banners and notification badges in the navigation bar.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.inAppEnabled} 
                onChange={(e) => setFormData({ ...formData, inAppEnabled: e.target.checked })} 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Email Notifications</p>
                <p className="text-xs text-slate-500">Send critical quality drop alerts and weekly digests to your primary email address.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.emailEnabled} 
                onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })} 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Slack Integration */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  <Slack className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Slack Webhook Dispatch</p>
                    <Badge variant={formData.slackEnabled ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {formData.slackEnabled ? 'Connected' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Dispatch instant notifications to team channels via incoming webhook.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.slackEnabled} 
                  onChange={(e) => setFormData({ ...formData, slackEnabled: e.target.checked })} 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {formData.slackEnabled && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Slack className="h-3.5 w-3.5 text-slate-500" />
                  Slack Incoming Webhook URL
                </label>
                <Input 
                  value={formData.slackWebhookUrl}
                  onChange={(e) => setFormData({ ...formData, slackWebhookUrl: e.target.value })}
                  placeholder="Enter incoming webhook URL (e.g. https://your-domain.slack.com/...)"
                  className="font-mono text-xs bg-white dark:bg-slate-900"
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Incoming webhooks post quality gate breaches and anomaly warnings directly into your designated Slack channel.
                </p>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Severity Filter Gate */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Minimum Severity Gate</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Only receive notifications for events that meet or exceed this alert severity threshold.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {severityOptions.map((opt) => {
              const isSelected = formData.minSeverity === opt.value
              return (
                <div 
                  key={opt.value}
                  onClick={() => setFormData({ ...formData, minSeverity: opt.value })}
                  className={`cursor-pointer rounded-lg p-4 border transition-all text-left flex flex-col justify-between ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500' 
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{opt.value}</span>
                      <Radio className={`h-4 w-4 ${isSelected ? 'text-blue-600 fill-blue-600' : 'text-slate-300 dark:text-slate-600'}`} />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Schedule & Quiet Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Quiet Hours & Digest Cadence</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Prevent notification fatigue by grouping alerts into digests or muting non-emergencies during rest hours.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          
          {/* Quiet Hours Window */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {formData.quietHoursEnabled ? (
                  <VolumeX className="h-4 w-4 text-amber-500" />
                ) : (
                  <Volume2 className="h-4 w-4 text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Quiet Hours Window</p>
                  <p className="text-xs text-slate-500">Silence email and Slack notifications during off-hours unless marked CRITICAL.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.quietHoursEnabled} 
                  onChange={(e) => setFormData({ ...formData, quietHoursEnabled: e.target.checked })} 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {formData.quietHoursEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                    Start Quiet Time (HH:mm)
                  </label>
                  <Input 
                    type="time" 
                    value={formData.quietStart}
                    onChange={(e) => setFormData({ ...formData, quietStart: e.target.value })}
                    className="bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                    End Quiet Time (HH:mm)
                  </label>
                  <Input 
                    type="time" 
                    value={formData.quietEnd}
                    onChange={(e) => setFormData({ ...formData, quietEnd: e.target.value })}
                    className="bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Digest Mode */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Batch Notifications into Digest</p>
                  <p className="text-xs text-slate-500">Hold non-critical alerts in a queue and deliver a consolidated rollup report.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.digestMode} 
                  onChange={(e) => setFormData({ ...formData, digestMode: e.target.checked })} 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {formData.digestMode && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Digest Frequency Cadence
                </label>
                <div className="flex gap-3">
                  {(['hourly', 'daily', 'weekly'] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFormData({ ...formData, digestFrequency: freq })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border capitalize transition-colors ${
                        formData.digestFrequency === freq
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </CardContent>
        <CardFooter className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 py-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Changes apply instantly to the PostgreSQL telemetry pipeline.
          </p>
          <Button 
            type="submit" 
            isLoading={updateMutation.isPending} 
            className="gap-2"
          >
            <Save className="h-4 w-4" /> Save Notification Preferences
          </Button>
        </CardFooter>
      </Card>

    </form>
  )
}
