import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useResetPasswordMutation } from '@/hooks/useAuthMutations'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const resetPassword = useResetPasswordMutation()
  const [password, setPassword] = useState('')
  const token = searchParams.get('token') ?? ''

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Set new password</h1>
        <p className="text-xs text-zinc-400">
          Enter a secure password for your SQDIS account.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          resetPassword.mutate({ token, password })
        }}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-300">
            Reset token
          </label>
          <input
            type="text"
            value={token}
            readOnly
            className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 text-xs font-mono text-zinc-400 select-all focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-300">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            required
            className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {resetPassword.error && (
          <div className="rounded-lg bg-rose-950/40 border border-rose-800/50 p-2.5">
            <p className="text-xs text-rose-300">
              {resetPassword.error instanceof Error ? resetPassword.error.message : 'Unable to reset password'}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={resetPassword.isPending || !token}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-950 hover:bg-white active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
        >
          {resetPassword.isPending ? 'Resetting password...' : 'Reset password'}
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
