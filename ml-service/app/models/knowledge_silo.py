"""
Team Knowledge Silo & Bus Factor Scoring Engine.
Implements the Avelino/Valente 80% contribution frontier and the
econometric Gini coefficient of code authorship inequality.
100% In-House, CPU-only execution.
"""
import logging
from typing import List
import numpy as np

from app.schemas.knowledge_silo import (
    AuthorContribution, ModuleContribution,
    AuthorOwnership, ModuleBusFactorResult,
    BusFactorAnalysisRequest, BusFactorAnalysisResponse,
    SiloRiskLevel
)

logger = logging.getLogger(__name__)


class KnowledgeSiloEngine:
    """
    Analyzes Git author commit frequencies and line churn distributions
    to detect single points of human failure and structural knowledge monopolies.
    """

    @staticmethod
    def compute_gini_coefficient(values: np.ndarray) -> float:
        """
        Computes the standard Gini coefficient of dispersion G in [0.0, 1.0].
        G = sum(|x_i - x_j|) / (2 * n * sum(x_i))
        """
        if len(values) == 0:
            return 0.0
        if len(values) == 1:
            return 1.0 if values[0] > 0 else 0.0
        
        total = np.sum(values)
        if total <= 0:
            return 0.0

        n = len(values)
        # Vectorized pairwise absolute differences: O(N^2) for small author sets (typically N < 50)
        diff_matrix = np.abs(np.subtract.outer(values, values))
        gini = np.sum(diff_matrix) / (2.0 * n * total)
        return float(np.clip(gini, 0.0, 1.0))

    def analyze_module(self, module: ModuleContribution) -> ModuleBusFactorResult:
        """
        Evaluates the Bus Factor and Gini concentration for a single module.
        """
        authors = module.authors
        if not authors:
            return ModuleBusFactorResult(
                module_name=module.module_name,
                bus_factor=0,
                gini_coefficient=0.0,
                risk_level=SiloRiskLevel.UNKNOWN,
                total_commits=0,
                total_churn=0,
                key_owners=[],
                author_ownerships=[],
                cross_training_recommendation="No author activity records provided for this module."
            )

        total_commits = sum(a.commit_count for a in authors)
        total_churn = sum(a.lines_added + a.lines_deleted for a in authors)

        if total_commits == 0 and total_churn == 0:
            return ModuleBusFactorResult(
                module_name=module.module_name,
                bus_factor=0,
                gini_coefficient=0.0,
                risk_level=SiloRiskLevel.UNKNOWN,
                total_commits=0,
                total_churn=0,
                key_owners=[],
                author_ownerships=[],
                cross_training_recommendation="Zero commits and churn detected in module."
            )

        # 1. Compute individual author contribution scores Cr(d)
        ownership_list = []
        scores = []
        for a in authors:
            c_share = (a.commit_count / total_commits) if total_commits > 0 else 0.0
            churn = a.lines_added + a.lines_deleted
            l_share = (churn / total_churn) if total_churn > 0 else 0.0

            # 50% commit frequency weight, 50% churn volume weight
            if total_commits > 0 and total_churn > 0:
                c_ratio = 0.5 * c_share + 0.5 * l_share
            elif total_commits > 0:
                c_ratio = c_share
            else:
                c_ratio = l_share

            scores.append(c_ratio)
            ownership_list.append({
                "author": a,
                "score": c_ratio,
                "c_share": c_share,
                "l_share": l_share
            })

        # 2. Sort authors descending by contribution score
        ownership_list.sort(key=lambda x: x["score"], reverse=True)

        # 3. Calculate Bus Factor (minimum authors required for >= 80% coverage)
        cum_score = 0.0
        bus_factor = 0
        key_owners = []
        ownership_results: List[AuthorOwnership] = []

        for item in ownership_list:
            author = item["author"]
            score = item["score"]
            is_key = False

            if cum_score < 0.80 or bus_factor == 0:
                bus_factor += 1
                cum_score += score
                key_owners.append(author.author_name)
                is_key = True

            ownership_results.append(AuthorOwnership(
                developer_id=author.developer_id,
                author_name=author.author_name,
                contribution_ratio=round(score, 4),
                commit_share=round(item["c_share"], 4),
                churn_share=round(item["l_share"], 4),
                is_key_owner=is_key
            ))

        # 4. Compute Gini coefficient of ownership concentration
        gini = self.compute_gini_coefficient(np.array(scores))

        # 5. Classify fragility risk
        if bus_factor == 1:
            risk = SiloRiskLevel.CRITICAL_SILO
            top_dev = key_owners[0] if key_owners else "Unknown"
            second_dev = ownership_list[1]["author"].author_name if len(ownership_list) > 1 else None
            if second_dev:
                recommendation = (
                    f"CRITICAL SILO: {top_dev} holds primary ownership ({ownership_list[0]['score']:.1%}). "
                    f"Action: Mandate that {second_dev} reviews all forthcoming PRs touching {module.module_name} to decentralize knowledge."
                )
            else:
                recommendation = (
                    f"EXTREME MONOPOLY: {top_dev} is the sole contributor. "
                    f"Action: Pair a secondary developer immediately for all modifications in {module.module_name}."
                )
        elif bus_factor == 2:
            risk = SiloRiskLevel.VULNERABLE
            recommendation = (
                f"VULNERABLE: Subsystem relies exclusively on {key_owners[0]} and {key_owners[1]}. "
                f"Action: Rotate secondary PR reviewers to build institutional memory."
            )
        else:
            risk = SiloRiskLevel.RESILIENT
            recommendation = (
                f"RESILIENT: Module knowledge is distributed across {bus_factor} key developers. "
                f"Healthy peer review and contribution balance."
            )

        return ModuleBusFactorResult(
            module_name=module.module_name,
            bus_factor=bus_factor,
            gini_coefficient=round(gini, 4),
            risk_level=risk,
            total_commits=total_commits,
            total_churn=total_churn,
            key_owners=key_owners,
            author_ownerships=ownership_results,
            cross_training_recommendation=recommendation
        )

    def analyze_repository(self, req: BusFactorAnalysisRequest) -> BusFactorAnalysisResponse:
        """
        Evaluates knowledge silos across multiple modules in a repository.
        """
        results: List[ModuleBusFactorResult] = []
        for m in req.modules:
            results.append(self.analyze_module(m))

        total_mods = len(results)
        if total_mods == 0:
            return BusFactorAnalysisResponse(
                repository_name=req.repository_name or "repository",
                overall_bus_factor=0,
                average_gini=0.0,
                total_modules_analyzed=0,
                critical_silos_count=0,
                vulnerable_count=0,
                resilient_count=0,
                module_results=[]
            )

        critical_count = sum(1 for r in results if r.risk_level == SiloRiskLevel.CRITICAL_SILO)
        vulnerable_count = sum(1 for r in results if r.risk_level == SiloRiskLevel.VULNERABLE)
        resilient_count = sum(1 for r in results if r.risk_level == SiloRiskLevel.RESILIENT)

        # Repository-level Bus Factor is bounded by its weakest critical module
        overall_bf = min(r.bus_factor for r in results) if results else 0
        avg_gini = float(np.mean([r.gini_coefficient for r in results])) if results else 0.0

        return BusFactorAnalysisResponse(
            repository_name=req.repository_name or "repository",
            overall_bus_factor=overall_bf,
            average_gini=round(avg_gini, 4),
            total_modules_analyzed=total_mods,
            critical_silos_count=critical_count,
            vulnerable_count=vulnerable_count,
            resilient_count=resilient_count,
            module_results=results
        )


bus_factor_engine = KnowledgeSiloEngine()
