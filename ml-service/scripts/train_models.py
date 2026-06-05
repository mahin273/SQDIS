import os
import pickle
import numpy as np
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TrainModels")

# Output directory
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models")
os.makedirs(MODEL_DIR, exist_ok=True)


def generate_dqs_data(n_samples=1000):
    """Generate synthetic developer performance metrics with realistic correlations."""
    np.random.seed(42)

    commit_count = np.random.randint(5, 80, n_samples)
    bug_fix_ratio = np.random.uniform(0.0, 0.7, n_samples)
    code_churn = np.random.uniform(0.05, 0.8, n_samples)
    coverage_avg = np.random.uniform(0.0, 100.0, n_samples)
    review_count = np.random.randint(0, 30, n_samples)
    review_turnaround = np.random.uniform(0.5, 72.0, n_samples)

    # Base formula with correlations
    base = 65.0
    # Positive factors
    base += np.minimum((commit_count / 25.0) * 12.0, 12.0)
    base += (coverage_avg / 100.0) * 18.0
    base += np.minimum((review_count / 12.0) * 12.0, 12.0)

    # Negative factors
    base -= bug_fix_ratio * 25.0
    base -= code_churn * 18.0
    base -= np.minimum((review_turnaround / 24.0) * 12.0, 12.0)

    # Add Gaussian noise
    noise = np.random.normal(0, 3, n_samples)
    score = np.clip(base + noise, 0.0, 100.0)

    df = pd.DataFrame({
        "commit_count_30d": commit_count,
        "bug_fix_ratio": bug_fix_ratio,
        "code_churn": code_churn,
        "coverage_avg": coverage_avg,
        "review_count": review_count,
        "review_turnaround_avg": review_turnaround,
        "score": score
    })
    return df


def generate_sqs_data(n_samples=500):
    """Generate synthetic project metrics with realistic correlations."""
    np.random.seed(42)

    avg_dqs = np.random.uniform(40.0, 95.0, n_samples)
    coverage = np.random.uniform(10.0, 100.0, n_samples)
    churn_rate = np.random.uniform(0.05, 0.7, n_samples)
    debt_count = np.random.randint(0, 50, n_samples)
    bug_density = np.random.uniform(0.0, 1.0, n_samples)

    # Base SQS formula
    base = 45.0
    # Positive factors
    base += (avg_dqs / 100.0) * 32.0
    base += (coverage / 100.0) * 28.0

    # Negative factors
    base -= churn_rate * 18.0
    base -= np.minimum((debt_count / 15.0) * 12.0, 12.0)
    base -= np.minimum(bug_density * 22.0, 22.0)

    # Add Gaussian noise
    noise = np.random.normal(0, 2, n_samples)
    score = np.clip(base + noise, 0.0, 100.0)

    df = pd.DataFrame({
        "avg_dqs": avg_dqs,
        "coverage": coverage,
        "churn_rate": churn_rate,
        "debt_count": debt_count,
        "bug_density": bug_density,
        "score": score
    })
    return df


def train_dqs_model():
    """Train XGBoost or GradientBoosting model for DQS."""
    logger.info("Generating synthetic DQS data...")
    df = generate_dqs_data()

    X = df[DQS_FEATURES := [
        "commit_count_30d", "bug_fix_ratio", "code_churn",
        "coverage_avg", "review_count", "review_turnaround_avg"
    ]].values
    y = df["score"].values

    model = None
    explainer = None
    model_type = "XGBoost"

    # Try importing xgboost
    try:
        from xgboost import XGBRegressor
        logger.info("Training XGBoost Regressor for DQS...")
        model = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)
        model.fit(X, y)
    except ImportError:
        logger.warning("xgboost not found. Falling back to sklearn.ensemble.GradientBoostingRegressor...")
        from sklearn.ensemble import GradientBoostingRegressor
        model = GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)
        model.fit(X, y)
        model_type = "GradientBoosting"

    # Try creating SHAP explainer
    try:
        import shap
        logger.info("Creating SHAP explainer for DQS...")
        explainer = shap.TreeExplainer(model)
    except Exception as e:
        logger.warning(f"Could not build SHAP explainer: {e}. Explanations will run in fallback simulation mode.")

    # Save model data
    model_path = os.path.join(MODEL_DIR, "dqs_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": model,
            "explainer": explainer,
            "version": "1.0.0",
            "model_type": model_type,
            "feature_names": DQS_FEATURES
        }, f)
    logger.info(f"DQS model saved successfully to {model_path}")


def train_sqs_model():
    """Train Random Forest model for SQS."""
    logger.info("Generating synthetic SQS data...")
    df = generate_sqs_data()

    X = df[SQS_FEATURES := [
        "avg_dqs", "coverage", "churn_rate", "debt_count", "bug_density"
    ]].values
    y = df["score"].values

    from sklearn.ensemble import RandomForestRegressor
    logger.info("Training RandomForest Regressor for SQS...")
    model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
    model.fit(X, y)

    # Save model data
    model_path = os.path.join(MODEL_DIR, "sqs_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": model,
            "version": "1.0.0",
            "model_type": "RandomForest",
            "feature_names": SQS_FEATURES
        }, f)
    logger.info(f"SQS model saved successfully to {model_path}")


def train_classification_model():
    """Train a TF-IDF + LogisticRegression model for commit classification."""
    logger.info("Preparing training dataset for Commit Classification...")

    # Define a rich corpus of synthetic commit messages mapping to categories
    dataset = [
        # BUGFIX
        ("fix login crash", "BUGFIX"),
        ("resolve crash in checkout flow", "BUGFIX"),
        ("fixed null pointer exception", "BUGFIX"),
        ("patched security vulnerability in oauth module", "BUGFIX"),
        ("fix bug in user validation", "BUGFIX"),
        ("corrected error in calculations", "BUGFIX"),
        ("hotfix for startup memory leak", "BUGFIX"),
        ("resolve null reference when fetching profiles", "BUGFIX"),
        ("fix undefined variable in dashboard", "BUGFIX"),
        ("fixed billing crash on expired cards", "BUGFIX"),
        ("correct billing recalculation exception", "BUGFIX"),
        ("patch memory leak in database pool", "BUGFIX"),
        ("fix regression in user settings save", "BUGFIX"),
        ("resolve database timeout crash", "BUGFIX"),
        
        # FEATURE
        ("feat: add stripe checkout integration", "FEATURE"),
        ("implement two-factor authentication flow", "FEATURE"),
        ("add support for localized languages", "FEATURE"),
        ("integrate sendgrid email notifier", "FEATURE"),
        ("created admin dashboard metrics page", "FEATURE"),
        ("new: enable push notifications", "FEATURE"),
        ("develop file upload service for profiles", "FEATURE"),
        ("feat: introduce slack alert channel", "FEATURE"),
        ("implement pagination for commits list", "FEATURE"),
        ("add dark mode toggle switch to header", "FEATURE"),
        ("created endpoint for exporting CSV logs", "FEATURE"),
        ("develop real-time notification socket gateway", "FEATURE"),
        
        # REFACTOR
        ("refactor authentication middlewares", "REFACTOR"),
        ("cleanup dead code and unused imports", "REFACTOR"),
        ("simplify database query performance in dashboard", "REFACTOR"),
        ("optimize index retrieval algorithms", "REFACTOR"),
        ("reorganize folder structure for clean arch", "REFACTOR"),
        ("rename method parameters for better readability", "REFACTOR"),
        ("remove deprecated configuration keys", "REFACTOR"),
        ("refactor helper functions into shared utils", "REFACTOR"),
        ("clean up styling classes in navbar", "REFACTOR"),
        ("simplify nested loops in code scanner", "REFACTOR"),
        ("optimize database connection acquisition", "REFACTOR"),
        ("reorganize config parameters into environment", "REFACTOR"),
        
        # TEST
        ("add tests for register controller", "TEST"),
        ("add specs for dashboard gateway", "TEST"),
        ("write unit tests for billing service", "TEST"),
        ("e2e tests for user signup flow", "TEST"),
        ("mock octokit API client responses", "TEST"),
        ("improve test coverage to 85 percent", "TEST"),
        ("fix failing tests in user auth suite", "TEST"),
        ("add integration tests for webhook delivery", "TEST"),
        ("write specs for dqs scores calculation", "TEST"),
        ("mock redis connections in test setup", "TEST"),
        
        # DOCS
        ("update README.md with deploy guidelines", "DOCS"),
        ("document API endpoints in swagger specification", "DOCS"),
        ("added comments explaining LCOM4 algorithm", "DOCS"),
        ("fix docstrings in commits models", "DOCS"),
        ("create release notes for version 1.0.0", "DOCS"),
        ("write setup guide for local development", "DOCS"),
        ("update license file headers", "DOCS"),
        ("add comments to explain taint tracking logic", "DOCS"),
        ("document environment variables requirements", "DOCS"),
        ("update wiki documentation with architecture diagram", "DOCS")
    ]

    # Duplicate dataset to make training robust
    dataset = dataset * 3

    texts = [item[0] for item in dataset]
    labels = [item[1] for item in dataset]

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline

    # Create classification pipeline
    pipeline = Pipeline([
        ('vectorizer', TfidfVectorizer(ngram_range=(1, 2), token_pattern=r'\b\w+\b', lowercase=True)),
        ('classifier', LogisticRegression(C=10.0, max_iter=200, random_state=42))
    ])

    logger.info("Training LogisticRegression pipeline for Commit Classification...")
    pipeline.fit(texts, labels)

    # Save pipeline
    model_path = os.path.join(MODEL_DIR, "classification_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump({
            "pipeline": pipeline,
            "version": "1.0.0",
            "model_type": "TFIDF-LogisticRegression"
        }, f)
    logger.info(f"Commit Classification model saved successfully to {model_path}")


def main():
    logger.info("Starting ML models training pipeline...")
    train_dqs_model()
    train_sqs_model()
    train_classification_model()
    logger.info("All ML models trained and saved successfully!")


if __name__ == "__main__":
    main()

