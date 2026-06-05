import numpy as np
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.anomaly import AnomalyDetector


def generate_normal_commits(n_samples: int = 900) -> np.ndarray:
    """
    Generate synthetic normal commit data for training.
    Normal commits follow realistic development distributions:
    - lines_changed: log-normal (mostly small, occasionally up to 2000 lines)
    - files_changed: log-normal (mostly 1-10, occasionally up to 40)
    - time_of_day: mostly active hours (7 AM to 11 PM), rare late-night commits
    - churn_ratio: broad range (0.0 to 1.0)
    """
    np.random.seed(42)

    # Log-normal distribution: exp(mean + std * N)
    lines_changed = np.random.lognormal(mean=4.2, sigma=1.1, size=n_samples) + 1.0
    lines_changed = np.clip(lines_changed, 1.0, 2000.0)

    files_changed = np.random.lognormal(mean=1.1, sigma=0.7, size=n_samples) + 1.0
    files_changed = np.clip(files_changed, 1.0, 40.0)

    # Time of day: 90% chance of 7-23, 10% chance of 0-6
    time_of_day = []
    for _ in range(n_samples):
        if np.random.rand() < 0.90:
            time_of_day.append(float(np.random.randint(7, 23)))
        else:
            time_of_day.append(float(np.random.randint(0, 7)))
    time_of_day = np.array(time_of_day)

    churn_ratio = np.random.uniform(0.0, 1.0, n_samples)

    return np.column_stack([
        lines_changed,
        files_changed,
        time_of_day,
        churn_ratio
    ])


def generate_anomalous_commits(n_samples: int = 100) -> np.ndarray:
    """
    Generate synthetic anomalous commit data for validation.
    Anomalous commits represent extreme outliers:
    - lines_changed: extreme massive bulk changes (5,000 to 50,000 lines)
    - files_changed: massive file spread (200 to 1000 files)
    - time_of_day: strictly dead of night (2 AM to 5 AM)
    - churn_ratio: extremely high or static (0.95 to 1.0)
    """
    np.random.seed(99)

    lines_changed = np.random.randint(5000, 50000, n_samples).astype(float)
    files_changed = np.random.randint(200, 1000, n_samples).astype(float)
    time_of_day = np.random.randint(2, 5, n_samples).astype(float)
    churn_ratio = np.random.uniform(0.95, 1.0, n_samples)

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