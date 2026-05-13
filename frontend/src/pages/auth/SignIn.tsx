import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IoLogoGithub, IoLogoGoogle } from 'react-icons/io5'
import { authApi } from '../../services/authApi'
import { useApi } from '../../hooks/useApi'

export default function SignIn() {
  const navigate = useNavigate()
  const backendBaseUrl = useMemo(
    () => import.meta.env.VITE_API_URL || 'http://localhost:3000',
    []
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { call: login, loading, error } = useApi(authApi.login)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await login({ email, password })
    if (result) navigate('/dashboard')
  }

  const onGoogle = () => {
    window.location.href = `${backendBaseUrl.replace(/\/$/, '')}/auth/google`
  }

  const onGitHub = () => {
    window.location.href = `${backendBaseUrl.replace(/\/$/, '')}/auth/github`
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-6">
        <p className="mb-4 text-sm text-gray-600">
          Already a User?{' '}
          <Link className="font-medium text-gray-900 hover:underline" to="/signin">
            Signin
          </Link>
        </p>

        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
            onClick={onGoogle}
          >
            <IoLogoGoogle />
            Login with Google
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
            onClick={onGitHub}
          >
            <IoLogoGithub />
            Login with Github
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium text-gray-500">OR</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-900" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-900" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600">
              {error.message || 'Login failed'}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign-in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-600">
          already a user?{' '}
          <Link className="font-medium text-gray-900 hover:underline" to="/signup">
            signup
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
