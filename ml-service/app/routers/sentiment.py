from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.sentiment import (
    SentimentAnalyzeRequest,
    SentimentAnalysisResult,
    BatchSentimentRequest,
    BatchSentimentResponse
)
from app.models.sentiment import sentiment_analyzer
import logging

logger = logging.getLogger(__name__)

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["Sentiment Analysis"])


@router.post("/sentiment/analyze", response_model=SentimentAnalysisResult)
async def analyze_sentiment(request: SentimentAnalyzeRequest) -> SentimentAnalysisResult:
    """
    Analyze sentiment of a single commit message.

    Returns sentiment category, detailed scores,
    confidence level, and sentiment indicators.
    """
    try:
        result = sentiment_analyzer.analyze(
            commit_message=request.commit_message,
            commit_id=request.commit_id
        )
        return result

    except Exception as e:
        logger.error(f"Sentiment analysis error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Sentiment analysis failed: {str(e)}"
        )


@router.post("/sentiment/analyze/batch", response_model=BatchSentimentResponse)
async def analyze_sentiment_batch(request: BatchSentimentRequest) -> BatchSentimentResponse:
    """
    Analyze sentiment for multiple commit messages at once.

    Returns individual results plus summary statistics
    including counts per sentiment category and averages.
    """
    try:
        # Analyze all messages
        results = sentiment_analyzer.analyze_batch(
            messages=request.messages,
            commit_ids=request.commit_ids
        )

        # Build summary statistics
        sentiment_counts = {}
        total_compound = 0.0
        total_confidence = 0.0

        for result in results:
            # Count each sentiment category
            sentiment_counts[result.sentiment] = sentiment_counts.get(result.sentiment, 0) + 1
            total_compound += result.scores.compound
            total_confidence += result.confidence

        count = len(results)
        summary = {
            "positive_count": sentiment_counts.get("POSITIVE", 0) + sentiment_counts.get("VERY_POSITIVE", 0),
            "negative_count": sentiment_counts.get("NEGATIVE", 0) + sentiment_counts.get("VERY_NEGATIVE", 0),
            "neutral_count": sentiment_counts.get("NEUTRAL", 0),
            "very_positive_count": sentiment_counts.get("VERY_POSITIVE", 0),
            "very_negative_count": sentiment_counts.get("VERY_NEGATIVE", 0),
            "average_compound": round(total_compound / count, 3) if count > 0 else 0.0,
            "average_confidence": round(total_confidence / count, 3) if count > 0 else 0.0,
        }

        return BatchSentimentResponse(
            results=results,
            summary=summary,
            processed_count=count
        )

    except Exception as e:
        logger.error(f"Batch sentiment analysis error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Batch sentiment analysis failed: {str(e)}"
        )


@router.get("/sentiment/health")
async def sentiment_health():
    """
    Check if the sentiment analyzer is working correctly.
    Runs a quick test to verify VADER is loaded and functional.
    """
    try:
        # Run a quick test analysis
        test_result = sentiment_analyzer.analyze("This is a great fix!")
        return {
            "status": "healthy",
            "service": "sentiment_analysis",
            "analyzer": "VADER",
            "test_passed": test_result.sentiment in ["POSITIVE", "VERY_POSITIVE"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sentiment analyzer unhealthy: {str(e)}"
        )