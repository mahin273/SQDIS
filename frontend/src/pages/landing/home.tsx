import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Feature from './feature'
import HowItWorks from './howitworks'
import Pricing from './pricing'

export default function Home() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const targetId = hash.replace('#', '')
    if (!targetId) return

    const el = document.getElementById(targetId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <main>
      <section
        id="top"
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center px-4 py-16"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-base font-medium tracking-wide text-gray-900 md:text-lg">
            AI-Powered Code Intelligence
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-gray-900 md:text-6xl">
            Ship Better Code, Faster
          </h1>
          <p className="mt-4 text-base leading-7 text-gray-600 md:text-lg">
            SQDIS uses machine learning to analyze your commits, measure developer quality, and help
            engineering teams build exceptional software.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-md bg-gray-900 px-5 py-2.5 text-base font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-black active:scale-[0.98]"
            >
              Start Free Trial
            </Link>
            <Link
              to="/#features"
              className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-base font-medium text-gray-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 active:scale-[0.98]"
            >
              Watch Demo
            </Link>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-gray-600">
            <li className="flex items-center gap-2">
              <span aria-hidden>✓</span>
              <span>No credit card required</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>✓</span>
              <span>14-day free trial</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>✓</span>
              <span>Cancel anytime</span>
            </li>
          </ul>
        </div>
      </section>

      <Feature />
      <HowItWorks />
      <Pricing />
    </main>
  )
}
