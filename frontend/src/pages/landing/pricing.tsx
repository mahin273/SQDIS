import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'

type Props = {
  id?: string
}

export default function Pricing({ id = 'pricing' }: Props) {
  const [annualBilling, setAnnualBilling] = useState(true)

  const plans = [
    {
      name: 'Developer Starter',
      description: 'Ideal for open-source maintainers and individual developers inspecting repositories.',
      priceMonthly: 0,
      priceAnnual: 0,
      features: [
        'Up to 5 developers',
        '3 connected repositories',
        'Tree-sitter AST cyclomatic analysis',
        'Real-time GitHub webhook sync',
        'Weekly automated quality summaries',
        'Community Discord support',
      ],
      ctaText: 'Start Free Forever',
      ctaHref: '/register',
      popular: false,
    },
    {
      name: 'Team Pro',
      description: 'Full-featured code intelligence and merge gates for scaling engineering squads.',
      priceMonthly: 35,
      priceAnnual: 29,
      features: [
        'Unlimited developers and seats',
        'Unlimited connected repositories',
        'Automated PR quality gate bot',
        'Sprint burndown and release readiness gates',
        'Custom alerts via Slack and email',
        'Technical debt remediation estimation',
        'Developer quality leaderboard (DQS)',
        'Priority email and Discord support',
      ],
      ctaText: 'Start 14-Day Free Trial',
      ctaHref: '/register',
      popular: true,
    },
    {
      name: 'Enterprise',
      description: 'Dedicated infrastructure, custom governance policies, and SLA guarantees.',
      priceMonthly: 'Custom',
      priceAnnual: 'Custom',
      features: [
        'Everything in Team Pro',
        'SAML 2.0 / Okta / Azure SSO integration',
        'Self-hosted Docker and Kubernetes Helm charts',
        'Custom ML model tuning and rulesets',
        'SOC-2 Type II audit report access',
        'Dedicated Solutions Architect',
        '99.99% Webhook and API uptime SLA',
      ],
      ctaText: 'Contact Solutions Architect',
      ctaHref: '/register',
      popular: false,
    },
  ]

  return (
    <section id={id} className="py-20 lg:py-28 scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 uppercase tracking-wider">
            Pricing Plans
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Predictable Pricing for High-Velocity Teams.
          </h2>
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Start free with up to 3 repositories. Upgrade as your engineering organization scales.
          </p>

          {/* Billing Interval Toggle */}
          <div className="pt-2 flex items-center justify-center gap-3">
            <span className={`text-xs font-mono ${!annualBilling ? 'text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setAnnualBilling(!annualBilling)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-zinc-300 dark:bg-zinc-700 transition-colors duration-200 ease-in-out focus:outline-hidden"
              role="switch"
              aria-checked={annualBilling}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  annualBilling ? 'translate-x-5 bg-indigo-600 dark:bg-indigo-400' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-mono flex items-center gap-1.5 ${annualBilling ? 'text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500'}`}>
              Annual
              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40">
                Save 17%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan, idx) => {
            const isCustom = typeof plan.priceMonthly === 'string'
            const price = isCustom
              ? 'Custom'
              : annualBilling
                ? `$${plan.priceAnnual}`
                : `$${plan.priceMonthly}`

            return (
              <div
                key={idx}
                className={`relative flex flex-col justify-between rounded-xl border p-7 transition-all ${
                  plan.popular
                    ? 'border-indigo-500/60 bg-white dark:bg-[#0c0e15] shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] shadow-xs'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-white shadow-xs">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-3xl sm:text-4xl font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {price}
                    </span>
                    {!isCustom && (
                      <span className="text-xs font-mono text-zinc-500">
                        / seat / month
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2.5 pt-2 text-xs text-zinc-600 dark:text-zinc-300">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2.5">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <Link
                    to={plan.ctaHref}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                      plan.popular
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xs'
                        : 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
