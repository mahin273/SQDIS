import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const faqs = [
    {
      q: 'How is the Software Quality Score (SQS) calculated?',
      a: 'SQS utilizes polyglot Tree-sitter AST parsing coupled with pre-trained ML models. It evaluates cyclomatic complexity, cognitive branch depth, coupling density, test coverage deltas, and defect risk probabilities to produce a calibrated 0-100 score benchmarked against historical baseline data.',
    },
    {
      q: 'Does SQDIS store or train models on our proprietary source code?',
      a: 'No. SQDIS never stores your proprietary source code files on persistent storage. All AST parsing and cyclomatic calculations occur ephemerally in worker RAM. Only sanitized, encrypted AST metadata (cyclomatic metrics, commit SHAs, line churn) are persisted with AES-256 encryption.',
    },
    {
      q: 'How does the GitHub and GitLab integration work?',
      a: 'You can connect in under 60 seconds using 1-click GitHub OAuth or a Personal Access Token. SQDIS automatically provisions HMAC-SHA256 authenticated webhooks for push, pull request, and review events to process commits with sub-second latency.',
    },
    {
      q: 'Can SQDIS block pull requests if quality thresholds are violated?',
      a: 'Yes. You can configure granular Quality Gate policies per repository or organization. When a pull request introduces severe cyclomatic hotspots or drops test coverage below your policy floor, SQDIS reports a failure check to the GitHub Checks API to halt merge approval.',
    },
    {
      q: 'Can we self-host SQDIS on our private cloud or Kubernetes cluster?',
      a: 'Yes. Enterprise tiers include complete Docker Compose and Kubernetes Helm chart deployment bundles designed for air-gapped or VPC-isolated environments with GitHub OAuth and role-based access control (RBAC).',
    },
  ]

  return (
    <section id="faq" className="border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-[#07080c] py-20 lg:py-28 scroll-mt-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 uppercase tracking-wider">
            Technical FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Frequently Asked Questions.
          </h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Everything you need to know about SQDIS code intelligence, security, and gates.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] transition-all"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <span className="text-sm sm:text-base font-mono">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-indigo-500' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
