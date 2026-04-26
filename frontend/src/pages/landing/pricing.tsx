import { Link } from 'react-router-dom'

type Props = {
  id?: string
}

export default function Pricing({ id = 'pricing' }: Props) {
  const starterFeatures = [
    'Up to 5 developers',
    '3 repositories',
    'Basic SQS metrics',
    'Weekly reports',
    'Community support',
  ]

  const teamFeatures = [
    'Unlimited developers',
    'Unlimited repositories',
    'Advanced ML analytics',
    'Sprint & release tracking',
    'Goal setting & alerts',
    'Priority support',
    'API access',
  ]

  const enterpriseFeatures = [
    'Everything in Team',
    'SSO & SAML',
    'Custom integrations',
    'Dedicated success manager',
    'SLA guarantee',
    'On-premise option',
    'Custom ML models',
  ]

  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-4 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-gray-900">Simple Pricing</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
          Start Free, Scale as You Grow
        </h2>
        <p className="mt-4 text-sm leading-6 text-gray-600">Transparent pricing with no hidden fees</p>
      </header>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="flex h-full flex-col rounded-xl border bg-white p-6">
          <div className="text-sm font-semibold text-gray-900">Starter</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight text-gray-900">Free</div>
          <p className="mt-2 text-sm text-gray-600">For small teams getting started</p>

          <ul className="mt-6 space-y-2 text-sm text-gray-600">
            {starterFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-900" aria-hidden>
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            <Link
              to="/signup"
              className="flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
            >
              Get started
            </Link>
          </div>
        </div>

        <div className="relative flex h-full flex-col rounded-xl border bg-white p-6">
          <span className="absolute right-4 top-4 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
            Most popular
          </span>

          <div className="text-sm font-semibold text-gray-900">Team</div>
          <div className="mt-3 flex items-end gap-2">
            <div className="text-4xl font-semibold tracking-tight text-gray-900">$29</div>
            <div className="pb-1 text-sm text-gray-600">/dev/month</div>
          </div>
          <p className="mt-2 text-sm text-gray-600">For growing engineering teams</p>

          <ul className="mt-6 space-y-2 text-sm text-gray-600">
            {teamFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-900" aria-hidden>
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            <Link
              to="/signup"
              className="flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
            >
              Start free trial
            </Link>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-xl border bg-white p-6">
          <div className="text-sm font-semibold text-gray-900">Enterprise</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight text-gray-900">Custom</div>
          <p className="mt-2 text-sm text-gray-600">For large organizations</p>

          <ul className="mt-6 space-y-2 text-sm text-gray-600">
            {enterpriseFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-900" aria-hidden>
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            <Link
              to="/signup"
              className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
            >
              Contact sales
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
