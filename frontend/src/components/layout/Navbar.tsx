import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900">
            SQDIS
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex">
          <a className="hover:text-gray-900" href="#">
            Anchor 1
          </a>
          <a className="hover:text-gray-900" href="#">
            Anchor 2
          </a>
          <a className="hover:text-gray-900" href="#">
            Anchor 3
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/signin"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Sign-in
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  )
}
