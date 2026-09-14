"""
bi[o]hub | 3D Centroid Detection & Dynamic Threshold Calibration Module
"""
import math
from typing import List, Dict, Tuple, Optional, Any
import numpy as np

try:
    import scipy.ndimage as ndi
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

from utils.spatial import SCALE_Z, SCALE_Y, SCALE_X


def detect_centroids_3d(
    volume: np.ndarray,
    t: int,
    start_node_id: int,
    dataset_name: str,
    target_node_count: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Extracts 3D cell centroids from a single timepoint volume.
    Applies adaptive percentile thresholding calibrated to target_node_count.
    """
    nodes: List[Dict[str, Any]] = []
    current_id = start_node_id

    if volume.max() > 0:
        p_val = 98.5 if target_node_count is None else max(90.0, min(99.5, 100.0 - (target_node_count * 0.05)))
        thresh = np.percentile(volume, p_val)
    else:
        thresh = 1000

    if SCIPY_AVAILABLE and volume.max() > 0:
        binary_mask = volume > thresh
        labeled, num_features = ndi.label(binary_mask)
        if num_features > 0:
            centers = ndi.center_of_mass(volume, labels=labeled, index=range(1, num_features + 1))
            if not isinstance(centers, list):
                centers = [centers]
            for c in centers:
                if c is not None and not any(math.isnan(coord) for coord in c):
                    z_vox, y_vox, x_vox = int(round(c[0])), int(round(c[1])), int(round(c[2]))
                    nodes.append({
                        "node_id": current_id,
                        "dataset": dataset_name,
                        "t": t,
                        "z": z_vox,
                        "y": y_vox,
                        "x": x_vox,
                        "z_phys": float(z_vox * SCALE_Z),
                        "y_phys": float(y_vox * SCALE_Y),
                        "x_phys": float(x_vox * SCALE_X),
                    })
                    current_id += 1
            return nodes, current_id

    peaks = np.argwhere(volume > max(1, thresh))
    if len(peaks) > 0:
        step = max(1, len(peaks) // 16)
        for pt in peaks[::step][:32]:
            nodes.append({
                "node_id": current_id,
                "dataset": dataset_name,
                "t": t,
                "z": int(pt[0]),
                "y": int(pt[1]),
                "x": int(pt[2]),
                "z_phys": float(pt[0] * SCALE_Z),
                "y_phys": float(pt[1] * SCALE_Y),
                "x_phys": float(pt[2] * SCALE_X),
            })
            current_id += 1

    return nodes, current_id
