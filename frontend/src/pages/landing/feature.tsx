import { FiGitBranch } from 'react-icons/fi'
import { GrInProgress } from 'react-icons/gr'
import { IoPeopleSharp } from 'react-icons/io5'
import { LuTarget } from 'react-icons/lu'
import { SiTextpattern } from 'react-icons/si'
import { LuBrain } from "react-icons/lu";
import InfoCard from '../../components/landing/InfoCard'

type Props = {
  id?: string
}

export default function Feature({ id = 'features' }: Props) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-4 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-gray-900">Powerful Features</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
          Everything You Need to
          <br />
          Ship Quality Code
        </h2>
        <p className="mt-4 text-sm leading-6 text-gray-600">
          Stop guessing about code quality. Get data-driven insights that help your team improve
          continuously.
        </p>
      </header>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard
          icon={<LuBrain />}
          title="ML-Powered Quality Scores"
          description="Our AI analyzes every commit to generate Software Quality Scores based on code complexity, patterns, and best practices."
        />
        <InfoCard
          icon={<GrInProgress />}
          title="Track Progress Over Time"
          description="Visualize how your team improves sprint over sprint with detailed trend analysis and historical comparisons."
        />
        <InfoCard
          icon={<IoPeopleSharp />}
          title="Team & Individual Insights"
          description="Get actionable insights at every level—from organization-wide metrics to individual developer performance."
        />
        <InfoCard
          icon={<FiGitBranch />}
          title="GitHub Integration"
          description="Connect your repositories in seconds. We analyze commits, PRs, and code reviews automatically."
        />
        <InfoCard
          icon={<LuTarget />}
          title="Goal Setting & Alerts"
          description="Set quality targets and get notified when metrics drop below thresholds or when developers need support."
        />
        <InfoCard
          icon={<SiTextpattern />}
          title="Code Pattern Analysis"
          description="Identify recurring patterns, anti-patterns, and opportunities for improvement across your codebase."
        />
      </div>
    </section>
  )
}
