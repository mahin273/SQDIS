import { Link } from 'react-router-dom'
import { IoLogoGithub, IoLogoGoogle } from 'react-icons/io5'

export default function SignIn() {
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
          >
            <IoLogoGoogle />
            Login with Google
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
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

        <form className="space-y-4">
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
            />
          </div>

          <button
            type="button"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
          >
            Sign-in
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
