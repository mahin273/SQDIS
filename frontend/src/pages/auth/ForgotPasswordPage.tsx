import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForgotPasswordMutation } from '@/hooks/useAuthMutations'

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPasswordMutation()
  const [email, setEmail] = useState('')

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Reset your password</h1>
        <p className="text-xs text-zinc-400">
          Enter your account email to receive reset instructions.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          forgotPassword.mutate(email)
        }}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-300">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {forgotPassword.isSuccess && (
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/50 p-2.5">
            <p className="text-xs text-emerald-300">Reset instructions sent. Please check your inbox.</p>
          </div>
        )}

        {forgotPassword.error && (
          <div className="rounded-lg bg-rose-950/40 border border-rose-800/50 p-2.5">
            <p className="text-xs text-rose-300">
              {forgotPassword.error instanceof Error ? forgotPassword.error.message : 'Unable to request reset'}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={forgotPassword.isPending}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-950 hover:bg-white active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
        >
          {forgotPassword.isPending ? 'Sending instructions...' : 'Send reset instructions'}
        </button>
      </form>

      <div className="pt-4 border-t border-zinc-800/80 text-center">
        <Link to="/login" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
          Return to sign in
        </Link>
      </div>
    </div>
  )
}
