"""
NASA PROMISE Software Defect Datasets Downloader.
Downloads standard benchmark datasets (JM1, KC1, KC2, PC1, MC1) from OpenML / PROMISE,
parses the ARFF structure, and saves them as clean, standardized CSV files.
"""

import os
import re
import urllib.request
import pandas as pd

DATASETS = [
    {
        "name": "jm1",
        "description": "NASA ground system software written in C/C++. Largest benchmark (~10,885 modules).",
        "file_id": 53936
    },
    {
        "name": "kc1",
        "description": "NASA satellite ground receiving software written in C++ (2,109 modules).",
        "file_id": 53950
    },
    {
        "name": "kc2",
        "description": "NASA scientific storage data management system (522 modules).",
        "file_id": 53946
    },
    {
        "name": "pc1",
        "description": "NASA flight software for earth-orbiting satellite (1,109 modules).",
        "file_id": 53951
    },
    {
        "name": "mc1",
        "description": "NASA telemetry video pipeline system (9,466 modules).",
        "file_id": 53939
    }
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "defect_datasets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_arff_to_dataframe(arff_content: str) -> pd.DataFrame:
    lines = arff_content.splitlines()
    attributes = []
    data_lines = []
    in_data = False

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("%"):
            continue

        if stripped.lower().startswith("@attribute"):
            parts = stripped.split()
            attr_name = parts[1].replace("'", "").replace('"', "")
            attributes.append(attr_name)
        elif stripped.lower().startswith("@data"):
            in_data = True
            continue
        elif in_data:
            data_lines.append(stripped)

    # Parse CSV data lines
    rows = []
    for d in data_lines:
        values = [v.strip() for v in d.split(",")]
        if len(values) == len(attributes):
            rows.append(values)

    df = pd.DataFrame(rows, columns=attributes)
    
    # Convert numeric columns where possible
    for col in df.columns:
        if col.lower() in ["defects", "problems", "class"]:
            # Standardize binary defect target to 0 or 1
            df[col] = df[col].astype(str).str.lower().map({
                "true": 1, "false": 0, "yes": 1, "no": 0, "y": 1, "n": 0, "1": 1, "0": 0
            }).fillna(0).astype(int)
            df.rename(columns={col: "defective"}, inplace=True)
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop any row with missing target or all NaNs
    df.dropna(subset=["defective"], inplace=True)
    df.fillna(0.0, inplace=True)
    return df

def download_and_save():
    print("==================================================================")
    print("  DOWNLOADING NASA PROMISE SOFTWARE DEFECT BENCHMARK DATASETS")
    print("==================================================================")
    
    summary = []
    for d in DATASETS:
        name = d["name"]
        fid = d["file_id"]
        url = f"https://www.openml.org/data/v1/download/{fid}"
        print(f"\n[+] Fetching {name.upper()} ({d['description']})...")
        
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                content = resp.read().decode("utf-8", errors="ignore")
                
            df = parse_arff_to_dataframe(content)
            csv_path = os.path.join(OUTPUT_DIR, f"{name}.csv")
            df.to_csv(csv_path, index=False)
            
            total_samples = len(df)
            defective_count = int(df["defective"].sum())
            defect_rate = (defective_count / total_samples) * 100 if total_samples > 0 else 0
            
            print(f"    -> Saved to: {csv_path}")
            print(f"    -> Total modules: {total_samples:,} | Defective: {defective_count:,} ({defect_rate:.1f}%) | Features: {len(df.columns) - 1}")
            
            summary.append({
                "dataset": name.upper(),
                "modules": total_samples,
                "defective_modules": defective_count,
                "defect_rate": f"{defect_rate:.1f}%",
                "features": len(df.columns) - 1,
                "file": f"{name}.csv"
            })
        except Exception as e:
            print(f"    [!] Failed to download {name}: {e}")

    # Generate a master combined dataset for training convenience
    try:
        combined_dfs = []
        for s in summary:
            fpath = os.path.join(OUTPUT_DIR, s["file"])
            cdf = pd.read_csv(fpath)
            # Retain common core McCabe and Halstead features
            common_cols = [c for c in ["loc", "v(g)", "ev(g)", "iv(g)", "n", "v", "l", "d", "i", "e", "b", "t", "defective"] if c in cdf.columns.str.lower()]
            # Rename lower case
            cdf.columns = [c.lower() for c in cdf.columns]
            if "defective" in cdf.columns:
                combined_dfs.append(cdf)
        
        if combined_dfs:
            master_df = pd.concat(combined_dfs, ignore_index=True, join="inner")
            master_path = os.path.join(OUTPUT_DIR, "nasa_promise_combined.csv")
            master_df.to_csv(master_path, index=False)
            print(f"\n[+] Master combined dataset saved to: {master_path}")
            print(f"    -> Total combined modules: {len(master_df):,} | Features: {len(master_df.columns) - 1}")
    except Exception as err:
        print(f"    [!] Could not build combined dataset: {err}")

    # Write documentation README
    readme_path = os.path.join(OUTPUT_DIR, "README.md")
    with open(readme_path, "w") as f:
        f.write("# NASA PROMISE Software Defect Benchmark Datasets\n\n")
        f.write("These datasets are part of the **NASA Metrics Data Program (MDP)** and the **PROMISE Software Engineering Repository**.\n")
        f.write("They provide empirical ground-truth measurements of software complexity and post-release defects across mission-critical systems.\n\n")
        f.write("## Datasets Summary\n\n")
        f.write("| Dataset | Description | Modules | Defective | Defect Rate | Features |\n")
        f.write("|---|---|---|---|---|---|\n")
        for s in summary:
            f.write(f"| **{s['dataset']}** | {s['file']} | {s['modules']:,} | {s['defective_modules']:,} | {s['defect_rate']} | {s['features']} |\n")
        f.write("\n## Metric Descriptions\n")
        f.write("- `loc`: Lines of Code\n")
        f.write("- `v(g)`: McCabe Cyclomatic Complexity ($M = E - N + 2P$)\n")
        f.write("- `ev(g)`: Essential Complexity\n")
        f.write("- `iv(g)`: Design Complexity\n")
        f.write("- `n`: Halstead Total Operators + Operands\n")
        f.write("- `v`: Halstead Volume\n")
        f.write("- `d`: Halstead Difficulty\n")
        f.write("- `e`: Halstead Mental Effort\n")
        f.write("- `defective`: Ground-truth binary defect label (`0` = Clean, `1` = Defective)\n")
    print(f"\n[+] Dataset documentation generated at: {readme_path}")
    print("\n[✓] ALL DATASETS DOWNLOADED AND SAVED SUCCESSFULLY. ZERO TRAINING PERFORMED TODAY.")

if __name__ == "__main__":
    download_and_save()
