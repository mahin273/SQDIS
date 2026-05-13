from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import List, Optional
from datetime import datetime
from app.schemas.sentiment import SentimentAnalysisResult, SentimentScore
import logging

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """
    VADER-based sentiment analyzer for commit messages.

    VADER (Valence Aware Dictionary and sEntiment Reasoner) is
    specifically designed for social media and short texts,
    making it perfect for commit messages.

    The analysis process:
    1. Pass commit message to VADER
    2. Get positive, negative, neutral, compound scores
    3. Categorize based on compound score thresholds
    4. Extract sentiment indicators from the message
    5. Calculate confidence based on score strength
    """

    def __init__(self):
        """Initialize VADER sentiment analyzer."""
        self.analyzer = SentimentIntensityAnalyzer()
        logger.info("VADER Sentiment Analyzer initialized successfully")

        # Positive indicators common in commit messages
        self.positive_indicators = [
            'fix', 'resolve', 'improve', 'enhance', 'optimize',
            'add', 'implement', 'feature', 'support', 'upgrade',
            'clean', 'refactor', 'simplify', 'awesome', 'great',
            'perfect', 'success', 'complete', 'done', 'working'
        ]

        # Negative indicators common in commit messages
        self.negative_indicators = [
            'bug', 'error', 'issue', 'problem', 'crash', 'fail',
            'broken', 'fix', 'hack', 'workaround', 'ugly', 'bad',
            'wrong', 'missing', 'annoying', 'terrible', 'horrible',
            'critical', 'urgent', 'emergency', 'panic', 'disaster'
        ]

    def _categorize_sentiment(self, compound: float) -> str:
        """
        Map compound score to human-readable sentiment category.

        VADER compound score ranges:
        >= 0.5  → VERY_POSITIVE (enthusiastic, excited)
        >= 0.05 → POSITIVE (satisfied, constructive)
        > -0.05 → NEUTRAL (factual, descriptive)
        > -0.5  → NEGATIVE (frustrated, concerned)
        <= -0.5 → VERY_NEGATIVE (angry, critical)

        Args:
            compound: VADER compound score (-1 to 1)

        Returns:
            Sentiment category string
        """
        if compound >= 0.5:
            return "VERY_POSITIVE"
        elif compound >= 0.05:
            return "POSITIVE"
        elif compound > -0.05:
            return "NEUTRAL"
        elif compound > -0.5:
            return "NEGATIVE"
        else:
            return "VERY_NEGATIVE"

    def _calculate_confidence(self, scores: dict) -> float:
        """
        Calculate confidence based on how strongly sentiment is expressed.

        Higher confidence when:
        - Compound score is far from 0 (strong sentiment)
        - One sentiment (pos/neg) dominates clearly

        Args:
            scores: VADER scores dictionary

        Returns:
            Confidence score between 0 and 1
        """
        compound = abs(scores['compound'])

        # Base confidence from compound score strength
        confidence = compound

        # Boost if positive or negative clearly dominates
        pos_neg_diff = abs(scores['pos'] - scores['neg'])
        if pos_neg_diff > 0.3:
            confidence = min(confidence + 0.1, 1.0)

        # Low confidence for very neutral messages
        if scores['neu'] > 0.9:
            confidence = min(confidence, 0.4)

        return round(confidence, 2)

    def _extract_indicators(self, message: str) -> List[str]:
        """
        Extract words from the message that indicate sentiment.

        Args:
            message: Commit message to analyze

        Returns:
            List of sentiment indicator words found in message
        """
        message_lower = message.lower()
        found_indicators = []

        # Check for positive indicators
        for word in self.positive_indicators:
            if word in message_lower:
                found_indicators.append(word)

        # Check for negative indicators
        for word in self.negative_indicators:
            if word in message_lower and word not in found_indicators:
                found_indicators.append(word)

        return found_indicators[:5]  # Return max 5 indicators

    def analyze(
        self,
        commit_message: str,
        commit_id: Optional[str] = None
    ) -> SentimentAnalysisResult:
        """
        Analyze sentiment of a single commit message.

        Args:
            commit_message: The commit message to analyze
            commit_id: Optional commit ID for tracking

        Returns:
            SentimentAnalysisResult with scores and category
        """
        logger.info(f"Analyzing sentiment for: {commit_message[:50]}...")

        # Get VADER scores
        vader_scores = self.analyzer.polarity_scores(commit_message)

        # Build sentiment score object
        scores = SentimentScore(
            positive=round(vader_scores['pos'], 3),
            negative=round(vader_scores['neg'], 3),
            neutral=round(vader_scores['neu'], 3),
            compound=round(vader_scores['compound'], 3)
        )

        # Categorize sentiment
        sentiment = self._categorize_sentiment(vader_scores['compound'])

        # Calculate confidence
        confidence = self._calculate_confidence(vader_scores)

        # Extract indicators
        indicators = self._extract_indicators(commit_message)

        logger.info(f"Sentiment result: {sentiment} (confidence: {confidence})")

        return SentimentAnalysisResult(
            commit_id=commit_id,
            sentiment=sentiment,
            scores=scores,
            confidence=confidence,
            indicators=indicators,
            timestamp=datetime.utcnow()
        )

    def analyze_batch(
        self,
        messages: List[str],
        commit_ids: Optional[List[str]] = None
    ) -> List[SentimentAnalysisResult]:
        """
        Analyze sentiment for multiple commit messages at once.

        Args:
            messages: List of commit messages
            commit_ids: Optional list of commit IDs

        Returns:
            List of SentimentAnalysisResult objects
        """
        results = []

        for i, message in enumerate(messages):
            # Get commit_id if provided
            commit_id = commit_ids[i] if commit_ids and i < len(commit_ids) else None
            result = self.analyze(message, commit_id)
            results.append(result)

        return results


# Create a single shared instance — initialized once, reused on every request
sentiment_analyzer = SentimentAnalyzer()