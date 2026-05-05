import re
from typing import Optional, List, Dict, Tuple
from app.schemas.classification import CommitType, ClassificationResult
import logging

logger = logging.getLogger(__name__)


class CommitClassifier:
    """
    Rule-based commit classifier using conventional commit patterns.

    The classification process:
    1. Score each commit type based on pattern matches
    2. Consider both commit message and file changes
    3. Select the type with the highest score
    4. Calculate confidence based on score distribution
    """

    def __init__(self):
        """Initialize the classifier with pattern definitions."""

        # Message patterns for each commit type
        self.patterns: Dict[CommitType, List[str]] = {
            CommitType.BUGFIX: [
                r'\b(fix|bugfix|hotfix|patch)\b',
                r'\b(bug|issue|error|crash|exception)\b',
                r'\b(resolve|correct|repair)\b.*\b(bug|issue|error)\b',
                r'\b(null pointer|undefined|memory leak)\b'
            ],
            CommitType.FEATURE: [
                r'\b(feat|feature|add|implement|create)\b',
                r'\b(new|introduce|support|enable)\b',
                r'\b(build|develop|integrate)\b',
            ],
            CommitType.REFACTOR: [
                r'\b(refactor|restructure|reorganize)\b',
                r'\b(cleanup|clean up|simplify|optimize)\b',
                r'\b(improve|enhance|upgrade)\b.*\b(code|structure|logic)\b',
                r'\b(remove|delete)\b.*\b(dead|unused|deprecated)\b',
                r'\b(rename|move|extract)\b',
            ],
            CommitType.TEST: [
                r'\b(test|tests|testing)\b',
                r'\b(spec|specs|coverage)\b',
                r'\b(unit test|integration test|e2e)\b',
                r'\b(mock|stub|fixture)\b',
            ],
            CommitType.DOCS: [
                r'\b(doc|docs|documentation)\b',
                r'\b(readme|changelog|license)\b',
                r'\b(comment|comments|docstring)\b',
                r'\b(wiki|guide|tutorial|example)\b',
            ],
        }

        # File extension patterns for each commit type
        self.file_patterns: Dict[CommitType, List[str]] = {
            CommitType.TEST: [
                r'\.test\.',
                r'\.spec\.',
                r'test_.*\.py',
                r'.*_test\.py',
                r'tests?/',
            ],
            CommitType.DOCS: [
                r'README',
                r'CHANGELOG',
                r'LICENSE',
                r'\.md$',
                r'\.rst$',
                r'docs?/',
            ],
        }

    def _score_message(self, message: str) -> Dict[CommitType, float]:
        """
        Score the commit message against all patterns.
        Returns a dictionary of commit type -> score.
        """
        message_lower = message.lower()
        scores: Dict[CommitType, float] = {ct: 0.0 for ct in CommitType}

        for commit_type, patterns in self.patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    scores[commit_type] += 1.0

        return scores

    def _score_files(self, files: List[str]) -> Dict[CommitType, float]:
        """
        Score the file paths against file extension patterns.
        Returns a dictionary of commit type -> score.
        """
        scores: Dict[CommitType, float] = {ct: 0.0 for ct in CommitType}

        for file_path in files:
            for commit_type, patterns in self.file_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, file_path, re.IGNORECASE):
                        # File patterns give 0.5 score each
                        scores[commit_type] += 0.5

        return scores

    def _calculate_confidence(
        self,
        scores: Dict[CommitType, float],
        winner: CommitType
    ) -> float:
        """
        Calculate confidence score based on score distribution.
        Higher confidence when winner has much higher score than others.
        """
        total = sum(scores.values())

        # No patterns matched at all — low confidence
        if total == 0:
            return 0.3

        winner_score = scores[winner]
        confidence = winner_score / total

        # Boost confidence if winner score is high enough
        if winner_score >= 2:
            confidence = min(confidence + 0.1, 1.0)

        return round(confidence, 2)

    def classify(
        self,
        commit_message: str,
        files_changed: Optional[List[str]] = None,
        diff_stats: Optional[dict] = None
    ) -> ClassificationResult:
        """
        Classify a commit message into one of the commit types.

        Args:
            commit_message: The commit message to classify
            files_changed: Optional list of changed file paths
            diff_stats: Optional diff statistics (not used in rule-based)

        Returns:
            ClassificationResult with classification, confidence, and method
        """
        logger.info(f"Classifying commit: {commit_message[:50]}...")

        # Score based on commit message
        scores = self._score_message(commit_message)

        # Add file-based scores if files are provided
        if files_changed:
            file_scores = self._score_files(files_changed)
            for commit_type in CommitType:
                scores[commit_type] += file_scores[commit_type]

        # Find the commit type with the highest score
        winner = max(scores, key=lambda ct: scores[ct])

        # Default to FEATURE if no patterns matched
        if scores[winner] == 0:
            winner = CommitType.FEATURE
            confidence = 0.3
        else:
            confidence = self._calculate_confidence(scores, winner)

        logger.info(f"Classification result: {winner} (confidence: {confidence})")

        return ClassificationResult(
            classification=winner,
            confidence=confidence,
            method="rule-based"
        )


# Create a single shared instance of the classifier
# This avoids re-creating it on every request (efficient!)
classifier = CommitClassifier()