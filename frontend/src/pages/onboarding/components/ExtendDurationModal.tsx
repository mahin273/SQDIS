import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export function ExtendDurationModal({
  open,
  onClose,
  currentEndDate,
  onExtend,
  isPending,
}: {
  open: boolean
  onClose: () => void
  currentEndDate?: string
  onExtend: (newEndDate: string, reason?: string) => void
  isPending?: boolean
}) {
  const [extensionDays, setExtensionDays] = useState('30')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setExtensionDays('30')
      setReason('')
    }
  }, [open])

  const calculateNewDate = (days: number): string => {
    const base = currentEndDate ? new Date(currentEndDate) : new Date()
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
    return next.toISOString()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const days = parseInt(extensionDays, 10) || 30
    const newDate = calculateNewDate(days)
    onExtend(newDate, reason || undefined)
  }

  return (
    <Modal open={open} onClose={onClose} title="Extend Onboarding Duration">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Additional Time Allowance
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[15, 30, 45, 60].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setExtensionDays(String(d))}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                  extensionDays === String(d)
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                +{d} Days
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            New End Date: {new Date(calculateNewDate(parseInt(extensionDays, 10) || 30)).toLocaleDateString()}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Reason for Extension (Optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Shift in squad focus or pending environment access"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending}>
            Extend Duration
          </Button>
        </div>
      </form>
    </Modal>
  )
}
