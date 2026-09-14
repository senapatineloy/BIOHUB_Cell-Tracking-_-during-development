"""
bi[o]hub | Spatial Anisotropy & Distance Utilities
"""
import math
from typing import Sequence, Union

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

SCALE_Z: float = 1.625
SCALE_Y: float = 0.40625
SCALE_X: float = 0.40625
SCALE_ZYX = np.array([SCALE_Z, SCALE_Y, SCALE_X], dtype=np.float64) if np is not None else [SCALE_Z, SCALE_Y, SCALE_X]
ANISOTROPY_RATIO: float = SCALE_Z / SCALE_X  # 4.0

MAX_MATCHING_DIST_UM: float = 7.0
HUNGARIAN_PENALTY_COST: float = 1e7
MIN_DAUGHTER_SEP_UM: float = 1.8
MAX_DAUGHTER_SEP_UM: float = 6.5


def physical_euclidean_distance(
    p1: Sequence[float],
    p2: Sequence[float],
    scale_zyx: Sequence[float] = (SCALE_Z, SCALE_Y, SCALE_X)
) -> float:
    """
    Computes physical Euclidean distance in µm between two coordinate vectors.
    d_phys = sqrt((1.625 * Δz)^2 + (0.40625 * Δy)^2 + (0.40625 * Δx)^2)
    """
    dz = (float(p1[0]) - float(p2[0])) * scale_zyx[0]
    dy = (float(p1[1]) - float(p2[1])) * scale_zyx[1]
    dx = (float(p1[2]) - float(p2[2])) * scale_zyx[2]
    return math.sqrt(dz * dz + dy * dy + dx * dx)

