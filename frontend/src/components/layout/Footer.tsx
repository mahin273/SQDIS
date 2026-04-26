import { Link } from 'react-router-dom'
import { GiChart } from 'react-icons/gi'

export default function Footer() {
  return (
    <footer className="border-t border-black bg-gray-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <Link
          to="/#top"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
        >
          <GiChart className="text-lg text-indigo-400" />
          <span>SQDIS</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-300">
          <a className="transition-colors duration-200 hover:text-white" href="#">
            Privacy
          </a>
          <a className="transition-colors duration-200 hover:text-white" href="#">
            Terms
          </a>
          <a className="transition-colors duration-200 hover:text-white" href="#">
            Security
          </a>
          <a className="transition-colors duration-200 hover:text-white" href="#">
            Contact
          </a>
        </nav>

        <div className="text-sm text-gray-300">© 2025 SQDIS. All rights reserved.</div>
      </div>
    </footer>
  )
}
