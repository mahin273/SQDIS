import { FaGithubAlt } from 'react-icons/fa'
import { GrPieChart } from 'react-icons/gr'
import { MdOutlineQueryStats } from 'react-icons/md'
import InfoCard from '../../components/landing/InfoCard'

type Props = {
  id?: string
}

export default function HowItWorks({ id = 'how-it-works' }: Props) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-4 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-gray-900">Simple Setup</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
          Get Started in Minutes
        </h2>
        <p className="mt-4 text-sm leading-6 text-gray-600">Three simple steps to better code quality</p>
      </header>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={<FaGithubAlt />}
          title="Connect Your GitHub"
          description="Link your GitHub organization with one click. We support both public and private repositories with secure OAuth."
        />
        <InfoCard
          icon={<MdOutlineQueryStats />}
          title="We Analyze Your Code"
          description="Our ML models analyze commits, calculate quality scores, and identify patterns in your codebase automatically."
        />
        <InfoCard
          icon={<GrPieChart />}
          title="Get Actionable Insights"
          description="View dashboards, set goals, and receive alerts. Help your team continuously improve their code quality."
        />
      </div>
    </section>
  )
}
