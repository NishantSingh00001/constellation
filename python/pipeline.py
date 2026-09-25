"""
Customer segmentation pipeline (pandas + scikit-learn).

This is the reference implementation of Constellation's model. The web app
runs a TypeScript/JavaScript port of the same steps inside Netlify Functions
(shared/pipeline.js), and `parity.py` checks that both produce the same
customers, features and clusters.

Steps
  1. Clean      drop guest rows, bad dates, cancellations/returns,
                zero-value lines and exact duplicate rows
  2. RFM        recency (days since last order), frequency (distinct
                orders), monetary (total spend) per customer
  3. Scale      log1p -> winsorise at 0.5% / 99.5% -> z-score
  4. Model      K-Means (k-means++, 10 restarts) for k = 2..8,
                pick the best silhouette score with k >= 3
  5. Label      name each cluster from its average RFM quintile scores

Usage
  python pipeline.py data/thread-and-clay-orders.csv [--k 5]
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score
from sklearn.preprocessing import StandardScaler

K_RANGE = range(2, 9)
WINSOR = (0.005, 0.995)
SEED = 42

# Prototype RFM scores (recency, frequency, monetary on a 1-5 scale).
ARCHETYPES = {
    "Champions": (4.6, 4.6, 4.6),
    "Loyal Customers": (3.9, 4.0, 3.9),
    "Potential Loyalists": (4.3, 2.9, 2.9),
    "New Customers": (4.6, 1.3, 1.6),
    "Promising": (3.6, 1.6, 1.7),
    "Need Attention": (3.0, 3.0, 3.0),
    "About to Sleep": (2.4, 2.0, 2.1),
    "At Risk": (1.9, 3.9, 3.8),
    "Can't Lose Them": (1.5, 4.6, 4.7),
    "Hibernating": (1.8, 1.9, 1.9),
    "Lost": (1.2, 1.1, 1.3),
}


def load(path: str) -> pd.DataFrame:
    return pd.read_csv(path, dtype={"Invoice": str, "Customer ID": str, "StockCode": str}, keep_default_na=False)


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = raw.copy()
    report = {}
    df["Customer ID"] = df["Customer ID"].str.strip().str.replace(r"\.0+$", "", regex=True)

    mask = df["Customer ID"] == ""
    report["missingCustomer"] = int(mask.sum())
    df = df[~mask]

    df["date"] = pd.to_datetime(df["InvoiceDate"], errors="coerce")
    mask = df["date"].isna()
    report["badDate"] = int(mask.sum())
    df = df[~mask]

    df["amount"] = df["Quantity"] * df["Price"]
    mask = df["Invoice"].str.upper().str.startswith("C") | (df["Quantity"] < 0) | (df["amount"] < 0)
    report["returns"] = int(mask.sum())
    df = df[~mask]

    mask = df["amount"] <= 0
    report["badValue"] = int(mask.sum())
    df = df[~mask]

    original_cols = list(raw.columns)
    mask = df.duplicated(subset=original_cols, keep="first")
    report["duplicates"] = int(mask.sum())
    df = df[~mask]
    return df, report


def rfm_table(df: pd.DataFrame) -> pd.DataFrame:
    snapshot = df["date"].max().normalize() + pd.Timedelta(days=1)
    g = df.groupby("Customer ID")
    rfm = pd.DataFrame(
        {
            "recency": (snapshot - g["date"].max()).dt.days,
            "frequency": g["Invoice"].nunique(),
            "monetary": g["amount"].sum().round(2),
            "tenure": (snapshot - g["date"].min()).dt.days,
        }
    )
    return rfm.sort_index()


def scale(rfm: pd.DataFrame) -> tuple[np.ndarray, StandardScaler]:
    logs = np.log1p(rfm[["recency", "frequency", "monetary"]])
    lo, hi = logs.quantile(WINSOR[0]), logs.quantile(WINSOR[1])
    clipped = logs.clip(lower=lo, upper=hi, axis=1)
    scaler = StandardScaler()
    return scaler.fit_transform(clipped), scaler


def scan_k(X: np.ndarray) -> pd.DataFrame:
    rows = []
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(X)
        rows.append(
            {
                "k": k,
                "inertia": km.inertia_,
                "silhouette": silhouette_score(X, km.labels_, sample_size=2000, random_state=SEED),
                "calinski_harabasz": calinski_harabasz_score(X, km.labels_),
                "davies_bouldin": davies_bouldin_score(X, km.labels_),
            }
        )
    return pd.DataFrame(rows)


def pick_k(scores: pd.DataFrame) -> int:
    return int(scores[scores["k"] >= 3].sort_values("silhouette", ascending=False).iloc[0]["k"])


def rfm_scores(rfm: pd.DataFrame) -> pd.DataFrame:
    n = len(rfm)

    def quintile(s: pd.Series, reverse: bool) -> pd.Series:
        rank = s.rank(method="first") - 1  # 0-based, ties broken by order
        q = np.minimum(5, np.floor(rank * 5 / n) + 1).astype(int)
        return 6 - q if reverse else q

    return pd.DataFrame(
        {"r": quintile(rfm["recency"], True), "f": quintile(rfm["frequency"], False), "m": quintile(rfm["monetary"], False)}
    )


def name_clusters(scores: pd.DataFrame, labels: np.ndarray) -> dict[int, str]:
    """Give each cluster a distinct archetype name (minimum total distance)."""
    from itertools import permutations

    means = scores.groupby(labels).mean()
    names = list(ARCHETYPES)
    protos = np.array([ARCHETYPES[n] for n in names])
    cost = ((means.values[:, None, :] - protos[None, :, :]) ** 2).sum(axis=2)
    k = len(means)
    if k <= 6:
        best = min(permutations(range(len(names)), k), key=lambda p: sum(cost[i, p[i]] for i in range(k)))
    else:  # Hungarian algorithm for larger k
        from scipy.optimize import linear_sum_assignment

        rows, cols = linear_sum_assignment(cost)
        best = [c for _, c in sorted(zip(rows, cols))]
    return {int(c): names[best[i]] for i, c in enumerate(means.index)}


@dataclass
class Result:
    rfm: pd.DataFrame
    report: dict
    scores: pd.DataFrame
    k: int
    labels: np.ndarray
    profile: pd.DataFrame


def run(path: str, k: int | None = None) -> Result:
    raw = load(path)
    df, report = clean(raw)
    rfm = rfm_table(df)
    X, _ = scale(rfm)
    scores = scan_k(X)
    k = k or pick_k(scores)
    labels = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit_predict(X)
    rfm_q = rfm_scores(rfm)
    names = name_clusters(rfm_q, labels)
    rfm = rfm.assign(cluster=labels, segment=[names[c] for c in labels])
    profile = (
        rfm.groupby("segment")
        .agg(customers=("recency", "size"), recency=("recency", "mean"), frequency=("frequency", "mean"),
             monetary=("monetary", "mean"), revenue=("monetary", "sum"))
        .assign(revenue_share=lambda t: t["revenue"] / t["revenue"].sum())
        .sort_values("revenue", ascending=False)
    )
    return Result(rfm, report, scores, k, labels, profile)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--k", type=int, default=None)
    args = ap.parse_args()
    res = run(args.csv, args.k)
    print("Cleaning:", json.dumps(res.report))
    print(f"Customers: {len(res.rfm):,}")
    print(res.scores.round(4).to_string(index=False))
    print(f"\nChosen k = {res.k}\n")
    print(res.profile.round(1).to_string())


if __name__ == "__main__":
    main()
