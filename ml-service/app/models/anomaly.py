from sklearn.ensemble import IsolationForest
import numpy as np
from typing import Dict, Optional
import joblib
import os
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    Isolation Forest-based anomaly detector for commits.

    The detector:
    1. Trains on normal commit data
    2. Learns what "normal" looks like
    3. Identifies commits that deviate from normal
    4. Maps scores to severity levels
    """

    def __init__(self, model_path: str = None):
        """
        Initialize the anomaly detector.

        Args:
            model_path: Path to saved model file (optional)
        """
        self.model_path = model_path
        self.model = None

        # Define feature names and their order
        self.feature_names = [
            'lines_changed',
            'files_changed',
            'time_of_day',
            'churn_ratio'
        ]

        # Try to load existing model, otherwise create new one
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            self.model = IsolationForest(
                n_estimators=100,      # Number of trees
                contamination=0.1,     # Expected 10% anomalies
                random_state=42,       # For reproducibility
                max_samples='auto'
            )
            logger.info("Initialized new Isolation Forest model")

    def load_model(self, path: str):
        """
        Load a trained model from disk.

        Args:
            path: Path to the .pkl file
        """
        try:
            self.model = joblib.load(path)
            logger.info(f"Loaded anomaly detection model from {path}")
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            raise

    def save_model(self, path: str):
        """
        Save the trained model to disk.

        Args:
            path: Path where to save the .pkl file
        """
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            joblib.dump(self.model, path)
            logger.info(f"Saved anomaly detection model to {path}")
        except Exception as e:
            logger.error(f"Failed to save model: {str(e)}")
            raise

    def _extract_features(self, features: dict) -> np.ndarray:
        """
        Extract and order features from the request dictionary.
        Ensures features are always in the correct order for the model.

        Args:
            features: Dictionary of feature name -> value

        Returns:
            numpy array of shape (1, 4)
        """
        feature_vector = []
        for name in self.feature_names:
            # Default to 0 if feature is missing
            value = features.get(name, 0)
            feature_vector.append(float(value))

        return np.array(feature_vector).reshape(1, -1)

    def _map_severity(self, score: float) -> str:
        """
        Map anomaly score to a human-readable severity level.

        Args:
            score: Anomaly score between 0.0 and 1.0

        Returns:
            Severity string: LOW, MEDIUM, HIGH, or CRITICAL
        """
        if score >= 0.9:
            return "CRITICAL"
        elif score >= 0.7:
            return "HIGH"
        elif score >= 0.5:
            return "MEDIUM"
        else:
            return "LOW"

    def train(self, X: np.ndarray):
        """
        Train the Isolation Forest model on normal commit data.

        Args:
            X: Training data of shape (n_samples, 4)
        """
        logger.info(f"Training anomaly detection model on {len(X)} samples...")
        self.model.fit(X)
        logger.info("Model training complete!")

    def _detect_heuristic(self, features: dict) -> Dict:
        """
        Rule-based heuristic fallback for anomaly detection if the model is not trained/fitted.
        """
        lines = float(features.get('lines_changed', 0))
        files = float(features.get('files_changed', 0))
        time = float(features.get('time_of_day', 0))
        churn = float(features.get('churn_ratio', 0))

        is_anomaly = False
        anomaly_score = 0.1
        reasons = []

        if lines > 5000:
            anomaly_score += 0.4
            reasons.append("Extreme lines changed")
        elif lines > 1000:
            anomaly_score += 0.2

        if files > 100:
            anomaly_score += 0.3
            reasons.append("Extreme files changed")
        elif files > 30:
            anomaly_score += 0.15

        if time >= 2 and time <= 5:
            anomaly_score += 0.2
            reasons.append("Dead of night commit")

        if churn > 0.95:
            anomaly_score += 0.1

        anomaly_score = min(anomaly_score, 1.0)
        is_anomaly = anomaly_score >= 0.6

        severity = self._map_severity(anomaly_score)

        return {
            "is_anomaly": bool(is_anomaly),
            "anomaly_score": round(anomaly_score, 2),
            "severity": severity,
            "model_version": "1.0.0-heuristic-fallback"
        }

    def detect(self, features: dict) -> Dict:
        """
        Detect if a commit is anomalous based on its features.

        Args:
            features: Dictionary with commit characteristics

        Returns:
            Dictionary with is_anomaly, anomaly_score, and severity
        """
        # Check if the model is fitted (Isolation Forest has estimators_ after fit)
        is_fitted = hasattr(self.model, 'estimators_')
        if not is_fitted:
            logger.warning("Isolation Forest model is not fitted. Operating in fallback mode.")
            return self._detect_heuristic(features)

        # Extract features in correct order
        X = self._extract_features(features)

        # Get prediction: -1 = anomaly, 1 = normal
        prediction = self.model.predict(X)[0]
        is_anomaly = prediction == -1

        # Get raw decision score and normalize to 0-1
        raw_score = self.model.decision_function(X)[0]
        # Normalize: higher score = more anomalous
        anomaly_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))

        # Map to severity level
        severity = self._map_severity(anomaly_score)

        logger.info(
            f"Anomaly detection result: "
            f"is_anomaly={is_anomaly}, "
            f"score={anomaly_score:.2f}, "
            f"severity={severity}"
        )

        return {
            "is_anomaly": bool(is_anomaly),
            "anomaly_score": round(anomaly_score, 2),
            "severity": severity,
            "model_version": "1.0.0"
        }