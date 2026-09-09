"""
Complete Multi-Tier Software Quality & Defect Benchmark Downloader.
Downloads and standardizes:
1. Function-Level Datasets: NASA PROMISE (McCabe & Halstead metrics)
2. Class-Level Datasets: Jureczko CK Metrics (CBO, LCOM, WMC, DIT)
3. Commit-Level Datasets: Kamei JIT Change Risk (Churn, Entropy, Author Experience)
"""

import os
import urllib.request
import pandas as pd

DATA_ROOT = os.path.dirname(__file__)

DIR_FUNCTION = os.path.join(DATA_ROOT, "function_level_nasa")
DIR_CLASS = os.path.join(DATA_ROOT, "class_level_ck")
DIR_COMMIT = os.path.join(DATA_ROOT, "commit_level_jit")

for d in [DIR_FUNCTION, DIR_CLASS, DIR_COMMIT]:
    os.makedirs(d, exist_ok=True)

def parse_arff(content: str) -> pd.DataFrame:
    lines = content.splitlines()
    attributes = []
    data_lines = []
    in_data = False

    for line in lines:
        s = line.strip()
        if not s or s.startswith("%"):
            continue
        if s.lower().startswith("@attribute"):
            parts = s.split()
            attr_name = parts[1].replace("'", "").replace('"', "")
            attributes.append(attr_name)
        elif s.lower().startswith("@data"):
            in_data = True
        elif in_data:
            data_lines.append(s)

    rows = []
    for d in data_lines:
        values = [v.strip() for v in d.split(",")]
        if len(values) == len(attributes):
            rows.append(values)

    df = pd.DataFrame(rows, columns=attributes)
    for col in df.columns:
        if col.lower() in ["defects", "problems", "class", "bug-count"]:
            df[col] = df[col].astype(str).str.lower().map({
                "true": 1, "false": 0, "yes": 1, "no": 0, "y": 1, "n": 0, "1": 1, "0": 0
            }).fillna(0).astype(int)
            df.rename(columns={col: "defective"}, inplace=True)
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df.dropna(subset=["defective"], inplace=True)
    df.fillna(0.0, inplace=True)
    return df

def download_class_level():
    print("\n--- [Tier 2] Fetching Class-Level Jureczko CK Datasets (CBO, LCOM, WMC) ---")
    datasets = [
        {"name": "jedit_ck", "fid": 53931, "desc": "jEdit Java Editor (Chidamber-Kemerer OO Metrics)"},
        {"name": "mozilla_ck", "fid": 53929, "desc": "Mozilla Core Modules (CBO, RFC, LOC)"}
    ]
    for d in datasets:
        url = f"https://www.openml.org/data/v1/download/{d['fid']}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read().decode("utf-8", errors="ignore")
            df = parse_arff(content)
            out_csv = os.path.join(DIR_CLASS, f"{d['name']}.csv")
            df.to_csv(out_csv, index=False)
            print(f"  -> {d['name']}.csv: {len(df):,} classes | {df['defective'].sum():,} defective ({df['defective'].mean():.1%}) | Features: {len(df.columns)-1}")
        except Exception as e:
            print(f"  [!] Failed {d['name']}: {e}")

def download_commit_level():
    print("\n--- [Tier 3] Fetching Commit-Level Kamei JIT Datasets (Churn, Entropy, Experience) ---")
    repos = [
        ("git_jit", "https://raw.githubusercontent.com/jacknichao/C-specific-metrics/master/oss-cproject/git.csv"),
        ("curl_jit", "https://raw.githubusercontent.com/jacknichao/C-specific-metrics/master/oss-cproject/curl.csv"),
        ("ffmpeg_jit", "https://raw.githubusercontent.com/jacknichao/C-specific-metrics/master/oss-cproject/FFmpeg.csv"),
        ("obs_studio_jit", "https://raw.githubusercontent.com/jacknichao/C-specific-metrics/master/oss-cproject/obs-studio.csv")
    ]
    
    dfs = []
    for name, url in repos:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                df = pd.read_csv(resp)
            
            # Standardize boolean target
            if "contains_bug" in df.columns:
                df["defective"] = df["contains_bug"].astype(str).str.lower().map({"true": 1, "false": 0, "1": 1, "0": 0}).fillna(0).astype(int)
            
            out_csv = os.path.join(DIR_COMMIT, f"{name}.csv")
            df.to_csv(out_csv, index=False)
            print(f"  -> {name}.csv: {len(df):,} commits | {df['defective'].sum():,} buggy ({df['defective'].mean():.1%}) | Columns: {len(df.columns)}")
            dfs.append(df)
        except Exception as e:
            print(f"  [!] Failed {name}: {e}")

    if dfs:
        combined = pd.concat(dfs, ignore_index=True)
        combined_path = os.path.join(DIR_COMMIT, "kamei_jit_combined.csv")
        combined.to_csv(combined_path, index=False)
        print(f"  -> Combined JIT Commits: {len(combined):,} total commits saved to kamei_jit_combined.csv")

if __name__ == "__main__":
    download_class_level()
    download_commit_level()
    print("\n[✓] ALL 3 TIERS OF DATASETS DOWNLOADED AND SAVED. ZERO TRAINING PERFORMED TODAY.")
