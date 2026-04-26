import { Link } from 'react-router-dom'
import { GiChart } from 'react-icons/gi'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/#top"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900"
          >
            <GiChart className="text-xl text-indigo-600" />
            <span>SQDIS</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex">
          <Link className="transition-colors duration-200 hover:text-gray-900" to="/#features">
            Feature
          </Link>
          <Link className="transition-colors duration-200 hover:text-gray-900" to="/#how-it-works">
            How it works
          </Link>
          <Link className="transition-colors duration-200 hover:text-gray-900" to="/#pricing">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/signin"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
          >
            Sign-in
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  )
}
