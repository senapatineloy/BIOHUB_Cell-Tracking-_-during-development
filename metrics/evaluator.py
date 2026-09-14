"""
bi[o]hub | Official Competition Evaluation Metrics Module
Adjusted Edge Jaccard & Division Jaccard Calculation
"""
from typing import List, Dict, Tuple, Any


def compute_adjusted_edge_jaccard(
    gt_edges: List[Dict[str, Any]],
    pred_edges: List[Dict[str, Any]],
    n_est: int,
    n_pred: int,
) -> Tuple[float, float, Dict[str, Any]]:
    """
    Computes the official Adjusted Edge Jaccard score:
      P = min(1.0, N_est / N_pred)
      Adj_Score = Raw_Jaccard * P
    """
    gt_set = {(int(e["source_id"]), int(e["target_id"])) for e in gt_edges}
    pred_set = {(int(e["source_id"]), int(e["target_id"])) for e in pred_edges}

    tp = len(gt_set.intersection(pred_set))
    fp = len(pred_set - gt_set)
    fn = len(gt_set - pred_set)

    raw_jaccard = tp / max(1, (tp + fp + fn))
    penalty_p = min(1.0, float(n_est) / max(1.0, float(n_pred)))
    adjusted_score = raw_jaccard * penalty_p

    telemetry = {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "raw_jaccard": raw_jaccard,
        "penalty_multiplier": penalty_p,
        "adjusted_score": adjusted_score,
        "n_est": n_est,
        "n_pred": n_pred,
    }
    return adjusted_score, raw_jaccard, telemetry
