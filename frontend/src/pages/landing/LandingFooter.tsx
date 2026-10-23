import { Link } from 'react-router-dom'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export default function LandingFooter() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#08090d] text-zinc-600 dark:text-zinc-400 text-xs font-mono">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1: Brand & Operational Status */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center">
              <Logo size="md" variant="neural" showSubtitle={false} />
            </Link>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed font-sans">
              Software Quality Intelligence & Developer Insights System. Ephemeral in-memory AST analysis, automated PR gates, and predictable engineering velocity.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>All Systems Operational</span>
              </div>
              <span className="text-[10px] text-zinc-400">&lt; 500ms Webhook SLA</span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="rounded p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="rounded p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="rounded p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Product
            </h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">AST Quality Engine</a></li>
              <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">PR Quality Gates</a></li>
              <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Technical Debt Radar</a></li>
              <li><a href="#telemetry" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Live Telemetry</a></li>
              <li><a href="#pricing" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Pricing Plans</a></li>
            </ul>
          </div>

          {/* Col 3: Architecture */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Architecture
            </h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Webhook Ingest</a></li>
              <li><a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Tree-sitter Parsing</a></li>
              <li><a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">ML Defect Classifier</a></li>
              <li><a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Checks API Dispatch</a></li>
              <li><a href="#faq" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">On-Premises Helm</a></li>
            </ul>
          </div>

          {/* Col 4: Compliance & Legal */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Governance
            </h4>
            <ul className="space-y-2 text-xs">
              <li><span className="text-zinc-500">SOC-2 Type II</span></li>
              <li><span className="text-zinc-500">Zero Code Retention</span></li>
              <li><span className="text-zinc-500">AES-256 Encryption</span></li>
              <li><span className="text-zinc-500">GDPR Compliant</span></li>
              <li><span className="text-zinc-500">Air-Gapped Ready</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <div>
            (c) {new Date().getFullYear()} SQDIS Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-zinc-700 dark:hover:text-zinc-300">Privacy Policy</span>
            <span className="hover:text-zinc-700 dark:hover:text-zinc-300">Terms of Service</span>
            <span className="hover:text-zinc-700 dark:hover:text-zinc-300">Security Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
