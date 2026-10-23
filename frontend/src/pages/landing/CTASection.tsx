import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Lock, Zap } from 'lucide-react'

export default function CTASection() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-24 bg-[#08090d] text-zinc-100 border-t border-zinc-800">
      {/* Subtle ambient illumination */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[48rem] h-[24rem] rounded-full bg-indigo-600/[0.04] blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs font-mono text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Zero Local Dependencies - 1-Click Cloud Setup</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
          Ready to Ship Higher Quality Code{' '}
          <span className="text-zinc-400">
            Without Slowing Down?
          </span>
        </h2>

        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Link your GitHub organization in 60 seconds with OAuth. No local agent to install, no CI build configuration files, and instant AST scoring on every commit.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition-all"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>Connect with GitHub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 px-6 py-3 text-sm font-mono font-medium text-zinc-300 transition-all"
          >
            <span>Sign In to Console</span>
          </Link>
        </div>

        {/* Trust Points */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> SOC-2 Type II Certified
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-indigo-400" /> Zero Proprietary Code Retained
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> 99.99% Uptime SLA
          </span>
        </div>
      </div>
    </section>
  )
}
