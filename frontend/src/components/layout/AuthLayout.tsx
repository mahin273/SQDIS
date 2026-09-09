import { Outlet, Link } from 'react-router-dom'
import { ShieldCheck, BarChart3, GitPullRequest } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const features = [
  {
    icon: <BarChart3 className="h-5 w-5 text-blue-400" />,
    title: 'Software Quality Intelligence',
    description: 'Comprehensive analytics for maintainability, test coverage, and technical debt.',
  },
  {
    icon: <GitPullRequest className="h-5 w-5 text-blue-400" />,
    title: 'Automated Developer Insights',
    description: 'Real-time commit impact scoring and peer review performance tracking.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5 text-blue-400" />,
    title: 'Enterprise RBAC & Security',
    description: 'Granular role hierarchies, audit logging, and automated compliance policies.',
  },
]

export function AuthLayout() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-900 text-slate-100 font-sans">
      {/* Left Column - Hero Branding & Features */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border-r border-slate-800 relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        {/* Logo Header */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center">
            <Logo size="lg" variant="solid" />
          </Link>
        </div>

        {/* Hero Copy & Feature List */}
        <div className="relative z-10 my-auto py-12 space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Empower your engineering teams with actionable quality metrics.
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Track code velocity, maintainability scores, and sprint health in one unified platform.
            </p>
          </div>

          <div className="space-y-6">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} SQDIS. All rights reserved.
        </div>
      </div>

      {/* Right Column - Auth Form Container */}
      <div className="col-span-1 lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md space-y-8">
          <div className="flex lg:hidden justify-center mb-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-xl text-white">
                S
              </div>
              <span className="text-2xl font-bold tracking-tight">SQDIS</span>
            </Link>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
