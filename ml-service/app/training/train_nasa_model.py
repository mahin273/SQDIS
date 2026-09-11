"""
NASA MDP / PROMISE Module-Level Defect Classifier Training Pipeline.
Trains an in-house supervised classifier using 14,626 empirical software modules
across NASA flight and ground systems (JM1, KC1, KC2, PC1).
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
DATA_PATH = os.path.join(BASE_DIR, "data", "function_level_nasa", "nasa_promise_combined.csv")
MODELS_DIR = os.path.join(BASE_DIR, "data", "models")
WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "..", "weights")

for d in [MODELS_DIR, WEIGHTS_DIR]:
    os.makedirs(d, exist_ok=True)

FEATURE_COLS = [
    "loc",
    "v_g",
    "ev_g",
    "iv_g",
    "n",
    "v",
    "d",
    "e",
    "uniq_op",
    "uniq_opnd",
    "branchcount"
]


def train_nasa_defect_classifier():
    print("--> Loading NASA MDP Software Defect Benchmark Dataset...")
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"NASA dataset not found at {DATA_PATH}")

    t0 = time.time()
    df = pd.read_csv(DATA_PATH)
    print(f"    Loaded {len(df):,} total module records in {time.time() - t0:.2f}s")

    # Clean and rename columns to standardize identifiers
    col_map = {
        "v(g)": "v_g",
        "ev(g)": "ev_g",
        "iv(g)": "iv_g"
    }
    df = df.rename(columns=col_map)

    # Coerce to numeric defensively
    for col in FEATURE_COLS + ["defective"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    X = df[FEATURE_COLS]
    y = df["defective"].astype(int)

    defective_count = int(y.sum())
    clean_count = len(y) - defective_count
    print(f"    Class Distribution: {clean_count:,} Clean ({clean_count/len(y)*100:.1f}%) | "
          f"{defective_count:,} Defective ({defective_count/len(y)*100:.1f}%)")

    scale_pos_weight = clean_count / max(1, defective_count)

    # Stratified train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"--> Training XGBoost Classifier on {len(X_train):,} training modules...")
    model = XGBClassifier(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric="logloss"
    )

    t_train = time.time()
    model.fit(X_train, y_train)
    print(f"    Model training completed in {time.time() - t_train:.2f}s")

    # Evaluation on Hold-Out Test Set
    test_probs = model.predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= 0.50).astype(int)

    roc_auc = float(roc_auc_score(y_test, test_probs))
    precision = float(precision_score(y_test, test_preds, zero_division=0))
    recall = float(recall_score(y_test, test_preds, zero_division=0))
    f1 = float(f1_score(y_test, test_preds, zero_division=0))

    print("\n--> Test Evaluation Performance (NASA Hold-Out Test Set):")
    print(f"    ROC-AUC Score:   {roc_auc:.4f} (Benchmark standard: >0.75)")
    print(f"    Recall (Catch):  {recall:.4f} ({recall*100:.1f}% of defective modules caught)")
    print(f"    Precision:       {precision:.4f}")
    print(f"    F1 Score:        {f1:.4f}")

    # Package model metadata
    model_package = {
        "model": model,
        "feature_names": FEATURE_COLS,
        "metrics": {
            "roc_auc": roc_auc,
            "precision": precision,
            "recall": recall,
            "f1": f1
        },
        "dataset": "NASA MDP / PROMISE (JM1, KC1, KC2, PC1)",
        "dataset_samples": len(df),
        "version": "1.0.0-nasa-xgboost"
    }

    # Save to weights directories
    for out_dir in [WEIGHTS_DIR, MODELS_DIR]:
        target = os.path.join(out_dir, "nasa_defect_model.pkl")
        with open(target, "wb") as f:
            pickle.dump(model_package, f)
        print(f"    Exported NASA Defect Model to: {target}")

    return model_package


if __name__ == "__main__":
    train_nasa_defect_classifier()
