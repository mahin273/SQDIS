import numpy as np
from typing import List, Tuple
from app.schemas.sqs import (
    ProjectMetrics, SQSResult, RiskyModule,
    Recommendation, RiskLevel
)
import logging

logger = logging.getLogger(__name__)


class SQSModel:
    """
    Software Quality Score (SQS) Calculator.

    Calculates a comprehensive project health score (0-100)
    based on 5 weighted components:

    1. Commit Quality    (30%) - How good are the commits?
    2. Activity          (20%) - How active is the team?
    3. Code Health       (25%) - How healthy is the codebase?
    4. Team Sentiment    (15%) - How is the team feeling?
    5. Documentation     (10%) - How well documented is it?
    """

    # Component weights — must sum to 1.0
    WEIGHTS = {
        "commit_quality": 0.30,
        "activity": 0.20,
        "code_health": 0.25,
        "team_sentiment": 0.15,
        "documentation": 0.10,
    }

    # Grade thresholds
    GRADE_THRESHOLDS = {
        "A": 85.0,
        "B": 70.0,
        "C": 55.0,
        "D": 40.0,
    }

    def _calculate_commit_quality_score(self, metrics: ProjectMetrics) -> float:
        """
        Calculate commit quality score (0-100).

        Considers:
        - Feature commit ratio (more features = better)
        - Commit message quality (better messages = better)
        - Bug fix ratio (too many bugs = worse)
        """
        # Feature commits are good — reward them
        feature_score = metrics.feature_commit_ratio * 100

        # Good commit messages are important
        message_score = metrics.avg_commit_message_quality * 100

        # Too many bug fixes indicate poor initial quality
        bug_penalty = metrics.bug_fix_ratio * 30

        score = (feature_score * 0.4) + (message_score * 0.4) - (bug_penalty * 0.2)
        return round(max(0.0, min(100.0, score)), 2)

    def _calculate_activity_score(self, metrics: ProjectMetrics) -> float:
        """
        Calculate team activity score (0-100).

        Considers:
        - Commit frequency (more consistent = better)
        - Active contributors (more contributors = better)
        """
        # Normalize commit frequency (ideal = 5 commits/day)
        freq_score = min(metrics.commit_frequency / 5.0, 1.0) * 100

        # Normalize contributors (ideal = 5+ contributors)
        contrib_score = min(metrics.active_contributors / 5.0, 1.0) * 100

        score = (freq_score * 0.6) + (contrib_score * 0.4)
        return round(max(0.0, min(100.0, score)), 2)

    def _calculate_code_health_score(self, metrics: ProjectMetrics) -> float:
        """
        Calculate code health score (0-100).

        Considers:
        - Anomaly score (fewer anomalies = better)
        - Code churn rate (lower churn = better)
        """
        # Low anomaly score is good — invert it
        anomaly_score = (1.0 - metrics.avg_anomaly_score) * 100

        # Low churn rate is good — invert it
        churn_score = (1.0 - metrics.code_churn_rate) * 100

        score = (anomaly_score * 0.6) + (churn_score * 0.4)
        return round(max(0.0, min(100.0, score)), 2)

    def _calculate_sentiment_score(self, metrics: ProjectMetrics) -> float:
        """
        Calculate team sentiment score (0-100).

        Considers:
        - Average sentiment score (positive = better)
        - Negative sentiment ratio (fewer negative = better)
        """
        # Normalize compound score from [-1,1] to [0,100]
        sentiment_score = ((metrics.avg_sentiment_score + 1.0) / 2.0) * 100

        # Penalize high negative sentiment ratio
        negative_penalty = metrics.negative_sentiment_ratio * 30

        score = sentiment_score - negative_penalty
        return round(max(0.0, min(100.0, score)), 2)

    def _calculate_documentation_score(self, metrics: ProjectMetrics) -> float:
        """
        Calculate documentation score (0-100).

        Considers:
        - Documentation commit ratio (more docs = better)
        """
        # Ideal doc ratio is 10-15% of all commits
        ideal_ratio = 0.12
        doc_score = min(metrics.doc_commit_ratio / ideal_ratio, 1.0) * 100

        return round(max(0.0, min(100.0, doc_score)), 2)

    def _calculate_sqs_score(
        self,
        commit_quality: float,
        activity: float,
        code_health: float,
        sentiment: float,
        documentation: float
    ) -> float:
        """
        Calculate final weighted SQS score (0-100).
        """
        score = (
            commit_quality * self.WEIGHTS["commit_quality"] +
            activity * self.WEIGHTS["activity"] +
            code_health * self.WEIGHTS["code_health"] +
            sentiment * self.WEIGHTS["team_sentiment"] +
            documentation * self.WEIGHTS["documentation"]
        )
        return round(score, 2)

    def _get_grade(self, score: float) -> str:
        """
        Convert numeric score to letter grade.
        A=85+, B=70+, C=55+, D=40+, F=below 40
        """
        if score >= self.GRADE_THRESHOLDS["A"]:
            return "A"
        elif score >= self.GRADE_THRESHOLDS["B"]:
            return "B"
        elif score >= self.GRADE_THRESHOLDS["C"]:
            return "C"
        elif score >= self.GRADE_THRESHOLDS["D"]:
            return "D"
        else:
            return "F"

    def _get_risk_level(self, score: float) -> RiskLevel:
        """
        Convert numeric score to risk level.
        Higher score = lower risk.
        """
        if score >= 75.0:
            return RiskLevel.LOW
        elif score >= 55.0:
            return RiskLevel.MEDIUM
        elif score >= 35.0:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL

    def _detect_risky_modules(self, metrics: ProjectMetrics) -> List[RiskyModule]:
        """
        Detect risky areas in the project based on metrics.
        Returns a list of risky modules with reasons.
        """
        risky_modules = []

        # Too many bug fixes — code quality risk
        if metrics.bug_fix_ratio > 0.4:
            risky_modules.append(RiskyModule(
                module="Code Quality",
                risk_level=RiskLevel.HIGH,
                reason=f"High bug fix ratio ({metrics.bug_fix_ratio:.0%}) indicates poor initial code quality",
                score=metrics.bug_fix_ratio
            ))

        # High anomaly score — stability risk
        if metrics.avg_anomaly_score > 0.6:
            risky_modules.append(RiskyModule(
                module="Commit Stability",
                risk_level=RiskLevel.HIGH,
                reason=f"High anomaly score ({metrics.avg_anomaly_score:.2f}) indicates unstable commit patterns",
                score=metrics.avg_anomaly_score
            ))

        # High churn rate — maintenance risk
        if metrics.code_churn_rate > 0.5:
            risky_modules.append(RiskyModule(
                module="Code Stability",
                risk_level=RiskLevel.MEDIUM,
                reason=f"High churn rate ({metrics.code_churn_rate:.0%}) indicates frequent rewrites",
                score=metrics.code_churn_rate
            ))

        # High negative sentiment — team morale risk
        if metrics.negative_sentiment_ratio > 0.3:
            risky_modules.append(RiskyModule(
                module="Team Morale",
                risk_level=RiskLevel.MEDIUM,
                reason=f"High negative sentiment ratio ({metrics.negative_sentiment_ratio:.0%}) may indicate team stress",
                score=metrics.negative_sentiment_ratio
            ))

        # Low commit frequency — activity risk
        if metrics.commit_frequency < 1.0:
            risky_modules.append(RiskyModule(
                module="Development Activity",
                risk_level=RiskLevel.MEDIUM,
                reason=f"Low commit frequency ({metrics.commit_frequency:.1f}/day) indicates slow development",
                score=1.0 - metrics.commit_frequency
            ))

        # Low documentation — docs risk
        if metrics.doc_commit_ratio < 0.05:
            risky_modules.append(RiskyModule(
                module="Documentation",
                risk_level=RiskLevel.LOW,
                reason=f"Very low documentation ratio ({metrics.doc_commit_ratio:.0%})",
                score=1.0 - metrics.doc_commit_ratio
            ))

        return risky_modules

    def _generate_recommendations(
        self,
        metrics: ProjectMetrics,
        sqs_score: float,
        risky_modules: List[RiskyModule]
    ) -> List[Recommendation]:
        """
        Generate actionable recommendations based on metrics and risks.
        """
        recommendations = []

        # Bug fix ratio too high
        if metrics.bug_fix_ratio > 0.3:
            recommendations.append(Recommendation(
                priority="HIGH",
                category="Code Quality",
                message="Implement code reviews and testing before merging to reduce bug fix commits"
            ))

        # Poor commit messages
        if metrics.avg_commit_message_quality < 0.5:
            recommendations.append(Recommendation(
                priority="HIGH",
                category="Commit Standards",
                message="Adopt conventional commits standard (feat:, fix:, docs:) for better commit messages"
            ))

        # Low activity
        if metrics.commit_frequency < 2.0:
            recommendations.append(Recommendation(
                priority="MEDIUM",
                category="Team Activity",
                message="Encourage more frequent smaller commits instead of large infrequent ones"
            ))

        # High anomaly score
        if metrics.avg_anomaly_score > 0.5:
            recommendations.append(Recommendation(
                priority="HIGH",
                category="Commit Patterns",
                message="Review large commits and late-night pushes — break work into smaller chunks"
            ))

        # High churn rate
        if metrics.code_churn_rate > 0.4:
            recommendations.append(Recommendation(
                priority="MEDIUM",
                category="Code Stability",
                message="Improve planning and design phase to reduce the need for rewrites"
            ))

        # Negative team sentiment
        if metrics.negative_sentiment_ratio > 0.25:
            recommendations.append(Recommendation(
                priority="MEDIUM",
                category="Team Health",
                message="High negative sentiment in commits — consider team check-ins and workload review"
            ))

        # Low documentation
        if metrics.doc_commit_ratio < 0.08:
            recommendations.append(Recommendation(
                priority="LOW",
                category="Documentation",
                message="Increase documentation — aim for at least 10% of commits to include docs updates"
            ))

        # Overall score very low
        if sqs_score < 40:
            recommendations.append(Recommendation(
                priority="HIGH",
                category="Overall Health",
                message="Project health is CRITICAL — immediate action needed across all areas"
            ))

        return recommendations

    def calculate(
        self,
        project_id: str,
        project_name: str,
        metrics: ProjectMetrics,
        period_days: int = 30
    ) -> SQSResult:
        """
        Calculate the complete Software Quality Score for a project.

        Args:
            project_id: Unique project identifier
            project_name: Human readable project name
            metrics: Project metrics object
            period_days: Analysis period in days

        Returns:
            SQSResult with complete scoring and recommendations
        """
        logger.info(f"Calculating SQS for project: {project_name}")

        # Calculate component scores
        commit_quality = self._calculate_commit_quality_score(metrics)
        activity = self._calculate_activity_score(metrics)
        code_health = self._calculate_code_health_score(metrics)
        sentiment = self._calculate_sentiment_score(metrics)
        documentation = self._calculate_documentation_score(metrics)

        # Calculate final weighted score
        sqs_score = self._calculate_sqs_score(
            commit_quality, activity, code_health, sentiment, documentation
        )

        # Get grade and risk level
        grade = self._get_grade(sqs_score)
        risk_level = self._get_risk_level(sqs_score)

        # Detect risky modules
        risky_modules = self._detect_risky_modules(metrics)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            metrics, sqs_score, risky_modules
        )

        logger.info(
            f"SQS Result: score={sqs_score}, grade={grade}, "
            f"risk={risk_level}, risks={len(risky_modules)}, "
            f"recommendations={len(recommendations)}"
        )

        return SQSResult(
            project_id=project_id,
            project_name=project_name,
            sqs_score=sqs_score,
            grade=grade,
            risk_level=risk_level,
            commit_quality_score=commit_quality,
            activity_score=activity,
            code_health_score=code_health,
            team_sentiment_score=sentiment,
            documentation_score=documentation,
            risky_modules=risky_modules,
            recommendations=recommendations,
            period_days=period_days
        )


# Single shared instance — initialized once, reused on every request
sqs_model = SQSModel()