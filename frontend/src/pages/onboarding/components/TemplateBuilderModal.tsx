import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ListChecks, AlertCircle } from 'lucide-react'

interface TemplateItemInput {
  title: string
  description?: string
}

export function TemplateBuilderModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: { name: string; description?: string; items: Array<{ title: string; description?: string; order: number }> }) => void
  isPending?: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<TemplateItemInput[]>([
    { title: 'Set up local Docker environment', description: 'Clone repository and verify docker compose runs cleanly' },
    { title: 'Run local test suite', description: 'Execute tests and confirm 100% green coverage' },
    { title: 'Review architecture documentation', description: 'Study domain modules, ER diagrams, and PR guidelines' },
    { title: 'Submit and merge first pull request', description: 'Achieve the Time-to-First-PR contribution milestone' },
  ])
  const [error, setError] = useState<string | null>(null)

  const handleAddItem = () => {
    setItems((prev) => [...prev, { title: '', description: '' }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('A template must have at least one checklist item.')
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const handleItemChange = (index: number, field: 'title' | 'description', value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a template name.')
      return
    }
    const emptyItem = items.some((item) => !item.title.trim())
    if (emptyItem) {
      setError('All checklist items must have a title.')
      return
    }

    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      items: items.map((item, idx) => ({
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        order: idx + 1,
      })),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Onboarding Checklist Template">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-700 text-xs flex items-center gap-2 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="e.g. Backend Engineer Ramp-Up Track"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Standard onboarding pathway for core backend contributors"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-indigo-500" />
              Checklist Steps ({items.length})
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Step
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-400">Step {idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Remove step"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                  placeholder="Task title (e.g. Clone repository & configure .env)"
                  className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  required
                />
                <input
                  type="text"
                  value={item.description || ''}
                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                  placeholder="Task description / instructions (optional)"
                  className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending}>
            Save Template
          </Button>
        </div>
      </form>
    </Modal>
  )
}
