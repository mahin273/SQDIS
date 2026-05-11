import numpy as np
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.anomaly import AnomalyDetector


def generate_normal_commits(n_samples: int = 900) -> np.ndarray:
    """
    Generate synthetic normal commit data for training.

    Normal commits have:
    - lines_changed: 10 to 500
    - files_changed: 1 to 20
    - time_of_day: 8 to 18 (working hours)
    - churn_ratio: 0.1 to 0.5
    """
    np.random.seed(42)

    lines_changed = np.random.randint(10, 500, n_samples).astype(float)
    files_changed = np.random.randint(1, 20, n_samples).astype(float)
    time_of_day = np.random.randint(8, 18, n_samples).astype(float)
    churn_ratio = np.random.uniform(0.1, 0.5, n_samples)

    return np.column_stack([
        lines_changed,
        files_changed,
        time_of_day,
        churn_ratio
    ])


def generate_anomalous_commits(n_samples: int = 100) -> np.ndarray:
    """
    Generate synthetic anomalous commit data for validation.

    Anomalous commits have:
    - lines_changed: 2000 to 10000 (massive changes)
    - files_changed: 50 to 200 (too many files)
    - time_of_day: 0 to 5 (late night)
    - churn_ratio: 0.7 to 1.0 (high churn)
    """
    np.random.seed(99)

    lines_changed = np.random.randint(2000, 10000, n_samples).astype(float)
    files_changed = np.random.randint(50, 200, n_samples).astype(float)
    time_of_day = np.random.randint(0, 5, n_samples).astype(float)
    churn_ratio = np.random.uniform(0.7, 1.0, n_samples)

    return np.column_stack([
        lines_changed,
        files_changed,
        time_of_day,
        churn_ratio
    ])


def main():
    """
    Main training script.
    Generates data, trains the model, and saves it to disk.
    """
    print("=" * 50)
    print("SQDIS Anomaly Detection Model Training")
    print("=" * 50)

    # Generate training data (normal commits only)
    print("\n1. Generating training data...")
    X_train = generate_normal_commits(900)
    print(f"   Generated {len(X_train)} normal commit samples")

    # Generate anomalous data for validation
    X_anomaly = generate_anomalous_commits(100)
    print(f"   Generated {len(X_anomaly)} anomalous commit samples")

    # Train the model
    print("\n2. Training Isolation Forest model...")
    detector = AnomalyDetector()
    detector.train(X_train)
    print("   Training complete!")

    # Save the model
    model_path = "data/models/anomaly_model.pkl"
    print(f"\n3. Saving model to {model_path}...")
    detector.save_model(model_path)
    print("   Model saved!")

    # Test with a normal commit
    print("\n4. Testing with normal commit...")
    normal_commit = {
        "lines_changed": 100,
        "files_changed": 5,
        "time_of_day": 14,
        "churn_ratio": 0.3
    }
    result = detector.detect(normal_commit)
    print(f"   Normal commit result: {result}")

    # Test with an anomalous commit
    print("\n5. Testing with anomalous commit...")
    anomalous_commit = {
        "lines_changed": 5000,
        "files_changed": 150,
        "time_of_day": 2,
        "churn_ratio": 0.9
    }
    result = detector.detect(anomalous_commit)
    print(f"   Anomalous commit result: {result}")

    print("\n" + "=" * 50)
    print("Training complete! Model ready to use.")
    print("=" * 50)


if __name__ == "__main__":
    main()