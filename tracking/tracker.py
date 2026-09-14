"""
bi[o]hub | Hungarian Bipartite Tracking with 7.0 µm Cutoff
"""
from typing import List, Dict, Any
import numpy as np

try:
    from scipy.optimize import linear_sum_assignment
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

from utils.spatial import MAX_MATCHING_DIST_UM, HUNGARIAN_PENALTY_COST


def link_consecutive_frames(
    nodes_t0: List[Dict[str, Any]],
    nodes_t1: List[Dict[str, Any]],
    dataset_name: str,
    max_matching_dist_um: float = MAX_MATCHING_DIST_UM,
) -> List[Dict[str, Any]]:
    """
    Computes optimal bipartite matching between consecutive timepoints t0 and t1.
    Strictly penalizes candidates exceeding 7.0 µm physical cutoff.
    """
    if not nodes_t0 or not nodes_t1:
        return []

    edges: List[Dict[str, Any]] = []
    n0 = len(nodes_t0)
    n1 = len(nodes_t1)

    coords_0 = np.array([[n["z_phys"], n["y_phys"], n["x_phys"]] for n in nodes_t0], dtype=np.float64)
    coords_1 = np.array([[n["z_phys"], n["y_phys"], n["x_phys"]] for n in nodes_t1], dtype=np.float64)

    diff = coords_0[:, np.newaxis, :] - coords_1[np.newaxis, :, :]
    dist_matrix = np.sqrt(np.sum(diff**2, axis=-1))

    cost_matrix = np.full((n0, n1), HUNGARIAN_PENALTY_COST, dtype=np.float64)
    valid_mask = dist_matrix <= max_matching_dist_um
    cost_matrix[valid_mask] = dist_matrix[valid_mask]

    if SCIPY_AVAILABLE:
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] < HUNGARIAN_PENALTY_COST:
                edges.append({
                    "dataset": dataset_name,
                    "source_id": int(nodes_t0[r]["node_id"]),
                    "target_id": int(nodes_t1[c]["node_id"]),
                    "physical_distance_um": float(dist_matrix[r, c]),
                })
    else:
        matched_targets = set()
        for r in range(n0):
            best_c = -1
            min_dist = max_matching_dist_um + 1.0
            for c in range(n1):
                if c not in matched_targets and dist_matrix[r, c] <= max_matching_dist_um:
                    if dist_matrix[r, c] < min_dist:
                        min_dist = dist_matrix[r, c]
                        best_c = c
            if best_c != -1:
                matched_targets.add(best_c)
                edges.append({
                    "dataset": dataset_name,
                    "source_id": int(nodes_t0[r]["node_id"]),
                    "target_id": int(nodes_t1[best_c]["node_id"]),
                    "physical_distance_um": float(min_dist),
                })

    return edges
