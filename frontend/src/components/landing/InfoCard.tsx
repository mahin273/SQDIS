import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: string
  description: string
}

export default function InfoCard({ icon, title, description }: Props) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 text-2xl text-gray-900">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  )
}
