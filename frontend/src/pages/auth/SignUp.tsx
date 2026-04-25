import { Link } from 'react-router-dom'
import { IoLogoGithub, IoLogoGoogle } from 'react-icons/io5'

export default function SignUp() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-6">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">Create your account</h1>

        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            <IoLogoGoogle />
            Sign up with Google
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            <IoLogoGithub />
            Sign up with Github
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium text-gray-500">OR</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-900" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Your name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-900" htmlFor="workEmail">
              Work email
            </label>
            <input
              id="workEmail"
              name="workEmail"
              type="email"
              placeholder="you@company.com"
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

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-900" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>

          <p className="text-xs text-gray-600">
            By signing up, you agree to our Terms and Privacy Policy
          </p>

          <button
            type="button"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <Link className="font-medium text-gray-900 hover:underline" to="/signin">
            Signin
          </Link>
        </p>
      </div>
    </main>
  )
}
