import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react'
import { useRegisterMutation } from '@/hooks/useAuthMutations'

export default function SignUp() {
  const register = useRegisterMutation()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const urlError = searchParams.get('error') || (location.state as any)?.error

  const backendBaseUrl = useMemo(
    () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    []
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setLocalError(null)

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.')
      return
    }

    register.mutate({ name, email, password })
  }

  return (
    <div className="w-full rounded-2xl border border-slate-800/90 bg-[#0c101d]/90 p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_35px_rgba(99,102,241,0.12)] backdrop-blur-2xl">
      {/* Header */}
      <div className="space-y-1.5 mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-400">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
          Get Started with SQDIS
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Create an account
        </h1>
        <p className="text-xs text-slate-400">
          Start tracking code quality and developer insight across your repositories.
        </p>
      </div>

      {/* Social Logins */}
      <div className="grid gap-2.5 sm:grid-cols-2 mb-6">
        <button
          type="button"
          onClick={() => {
            window.location.href = `${backendBaseUrl.replace(/\/$/, '')}/auth/google`
          }}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/60 px-3 text-xs font-medium text-slate-200 transition-all hover:bg-slate-800 hover:border-slate-700 hover:text-white active:scale-[0.99]"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
          </svg>
          <span>Google</span>
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = `${backendBaseUrl.replace(/\/$/, '')}/auth/github`
          }}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/60 px-3 text-xs font-medium text-slate-200 transition-all hover:bg-slate-800 hover:border-slate-700 hover:text-white active:scale-[0.99]"
        >
          <svg className="h-4 w-4 shrink-0 fill-current text-white" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
          </svg>
          <span>GitHub</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800/80" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-semibold tracking-widest">
          <span className="bg-[#0c101d] px-3 text-slate-400">
            or register with email
          </span>
        </div>
      </div>

      {urlError && (
        <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3">
          <p className="text-xs font-medium text-rose-400">
            {urlError}
          </p>
        </div>
      )}

      {/* Form */}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Full name
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              <User className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mahin Hasan"
              required
              className="flex h-11 w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Work email
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              required
              className="flex h-11 w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Password <span className="text-slate-400 font-normal">(min 8 characters)</span>
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
              required
              className="flex h-11 w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-10 text-sm text-white placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-slate-400 hover:text-slate-300 transition-colors p-1"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {(localError || register.error) && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5">
            <p className="text-xs font-medium text-rose-400">
              {localError || (register.error instanceof Error ? register.error.message : 'Registration failed')}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:shadow-indigo-600/50 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {register.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating workspace...
            </span>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      {/* Footer link */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  )
}
