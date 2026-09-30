import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
export interface MentorOption {
  id: string
  name: string
  avatarUrl?: string
  currentMentees?: number
  email?: string
}

export function AssignMentorModal({
  open,
  onClose,
  mentors,
  onAssign,
  isPending,
}: {
  open: boolean
  onClose: () => void
  mentors: MentorOption[]
  onAssign: (mentorId: string) => void
  isPending?: boolean
}) {
  const [selectedMentorId, setSelectedMentorId] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedMentorId('')
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMentorId) return
    onAssign(selectedMentorId)
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Onboarding Mentor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select Senior Developer / Mentor</label>
          <select
            value={selectedMentorId}
            onChange={(e) => setSelectedMentorId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            required
          >
            <option value="">Choose a mentor...</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isPending}>Assign Mentor</Button>
        </div>
      </form>
    </Modal>
  )
}
