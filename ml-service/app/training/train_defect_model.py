"""
Empirical Just-In-Time (JIT) Defect Classifier Training Pipeline.
Trains an in-house supervised classifier using 235,000+ empirical commits
from the Kamei et al. benchmark (Git, Curl, FFmpeg, OBS Studio).
100% On-Premise, CPU-only execution.
"""
import os
import pickle
import time
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_PATH = os.path.join(BASE_DIR, "data", "commit_level_jit", "kamei_jit_combined.csv")
MODELS_DIR = os.path.join(BASE_DIR, "data", "models")
WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "..", "weights")

for d in [MODELS_DIR, WEIGHTS_DIR]:
    os.makedirs(d, exist_ok=True)

FEATURE_NAMES = [
    "added_lines",
    "deleted_lines",
    "modified_files_count",
    "max_cyclomatic_complexity",
    "author_experience_commits",
    "directory_entropy"
]

def train_defect_classifier():
    print("--> Loading Kamei et al. Empirical JIT Commit Dataset...")
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Empirical dataset not found at {DATA_PATH}")

    t0 = time.time()
    df = pd.read_csv(DATA_PATH)
    print(f"    Loaded {len(df):,} total commit records in {time.time() - t0:.2f}s")

    # Construct the 6-dimensional feature matrix
    print("--> Engineering Empirical Features...")
    la = df["la"].fillna(0).astype(float)
    ld = df["ld"].fillna(0).astype(float)
    nf = df["nf"].fillna(1).astype(float)
    entropy = df["entropy"].fillna(0.0).astype(float)
    exp = df["exp"].fillna(1).astype(float)

    # Calculate peak cyclomatic complexity from control-flow jump markers + addition volume
    complexity = (
        1.0
        + df.get("gotostm", 0).fillna(0) * 2.0
        + df.get("singlepointer", 0).fillna(0)
        + df.get("maxpointerdepth", 0).fillna(0) * 1.5
        + np.log1p(la) * 1.2
    )

    X = pd.DataFrame({
        "added_lines": la,
        "deleted_lines": ld,
        "modified_files_count": nf,
        "max_cyclomatic_complexity": complexity,
        "author_experience_commits": exp,
        "directory_entropy": entropy
    }, columns=FEATURE_NAMES)

    y = df["defective"].fillna(0).astype(int)

    defective_count = int(y.sum())
    clean_count = len(y) - defective_count
    print(f"    Class Distribution: {clean_count:,} Clean ({clean_count/len(y)*100:.1f}%) | "
          f"{defective_count:,} Defective ({defective_count/len(y)*100:.1f}%)")

    # Stratified split to preserve class imbalance ratio in test set
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Dynamic class weighting to handle minority defect class
    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
    print(f"    Computed scale_pos_weight: {scale_pos_weight:.2f}")

    print("--> Training XGBoost Defect Classifier...")
    model = XGBClassifier(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric="logloss",
        tree_method="hist"
    )
    model.fit(X_train, y_train)

    print("--> Evaluating Classifier Performance on Test Set...")
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= 0.5).astype(int)

    roc_auc = float(roc_auc_score(y_test, probs))
    precision = float(precision_score(y_test, preds, zero_division=0))
    recall = float(recall_score(y_test, preds, zero_division=0))
    f1 = float(f1_score(y_test, preds, zero_division=0))

    print(f"    Test ROC-AUC:   {roc_auc:.4f}  (Target > 0.75)")
    print(f"    Test Recall:    {recall:.4f}")
    print(f"    Test Precision: {precision:.4f}")
    print(f"    Test F1-Score:  {f1:.4f}")

    payload = {
        "model": model,
        "version": "1.0.0-xgb",
        "model_type": "XGBClassifier",
        "feature_names": FEATURE_NAMES,
        "metrics": {
            "roc_auc": roc_auc,
            "precision": precision,
            "recall": recall,
            "f1": f1
        },
        "dataset_samples": len(df),
        "thresholds": {"low": 0.35, "moderate": 0.70}
    }

    for target_dir in [MODELS_DIR, WEIGHTS_DIR]:
        out_path = os.path.join(target_dir, "defect_model.pkl")
        with open(out_path, "wb") as f:
            pickle.dump(payload, f)
        print(f"    Successfully exported defect classifier to: {out_path}")

if __name__ == "__main__":
    train_defect_classifier()
