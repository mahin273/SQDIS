import { Link } from 'react-router-dom'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1: Brand */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center">
              <Logo size="md" variant="solid" showSubtitle={false} />
            </Link>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Software Quality Intelligence & Developer Insights System. Empowering engineering teams to measure quality, eliminate technical debt, and ship software with confidence.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Product
            </h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Quality Engine (SQS)</a></li>
              <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Tech Debt Radar</a></li>
              <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Developer Leaderboard</a></li>
              <li><a href="#preview" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Live Demo</a></li>
              <li><a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing Plans</a></li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Resources
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Documentation</Link></li>
              <li><a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a></li>
              <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">API Reference</Link></li>
              <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Webhooks Guide</Link></li>
              <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Changelog</Link></li>
            </ul>
          </div>

          {/* Col 4: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Account
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Create Account</Link></li>
              <li><Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link></li>
              <li><Link to="/settings" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Settings</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} SQDIS. All rights reserved. Software Quality Intelligence.
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All Systems Operational</span>
            </div>
            <span>•</span>
            <span className="text-slate-400 hover:underline cursor-pointer">Privacy Policy</span>
            <span className="text-slate-400 hover:underline cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
