"""
Checks that the JavaScript pipeline used in production (shared/pipeline.js)
matches the pandas + scikit-learn reference (pipeline.py) on the same data.

  npm run parity        # from the repo root
"""

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score

import pipeline as ref

HERE = Path(__file__).parent
DATA = HERE / "data"


def main() -> int:
    js = json.loads((DATA / "js_result.json").read_text())
    raw = ref.load(str(DATA / "thread-and-clay-orders.csv"))
    df, report = ref.clean(raw)
    rfm = ref.rfm_table(df)
    X, _ = ref.scale(rfm)
    scores = ref.scan_k(X)

    checks = []

    def check(name, ok, detail):
        checks.append((name, ok, detail))

    check("Cleaning counts", report == js["cleaning"], f"python {report} | js {js['cleaning']}")
    ids_match = list(rfm.index) == js["customers"]["id"]
    check("Same customers", ids_match, f"{len(rfm):,} customers")
    for col, key in [("recency", "r"), ("frequency", "f"), ("monetary", "m")]:
        diff = np.abs(rfm[col].to_numpy() - np.array(js["customers"][key])).max() if ids_match else np.inf
        check(f"{col.capitalize()} values", diff < 0.011, f"max abs diff {diff:.4f}")

    js_c = {c["k"]: c for c in js["candidates"]}
    worst_inertia = max(abs(r.inertia - js_c[r.k]["inertia"]) / r.inertia for r in scores.itertuples())
    check("Inertia for k = 2..8", worst_inertia < 0.01, f"worst relative gap {worst_inertia:.3%}")
    worst_sil = max(abs(r.silhouette - js_c[r.k]["silhouette"]) for r in scores.itertuples())
    check("Silhouette for k = 2..8", worst_sil < 0.03, f"worst abs gap {worst_sil:.4f} (both use a 2,000-point sample)")

    py_k = ref.pick_k(scores)
    check("Chosen k", py_k == js["chosenK"], f"python {py_k} | js {js['chosenK']}")

    for k, seg in [(js["chosenK"], js["customers"]["seg"]), (5, js["k5"]["seg"])]:
        labels = KMeans(n_clusters=k, n_init=10, random_state=ref.SEED).fit_predict(X)
        ari = adjusted_rand_score(labels, seg)
        check(f"Cluster agreement at k = {k}", ari > 0.95, f"adjusted Rand index {ari:.4f}")

    width = max(len(c[0]) for c in checks)
    for name, ok, detail in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
    summary = {name: {"pass": bool(ok), "detail": detail} for name, ok, detail in checks}
    (DATA / "parity_report.json").write_text(json.dumps(summary, indent=2))
    return 0 if all(ok for _, ok, _ in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
