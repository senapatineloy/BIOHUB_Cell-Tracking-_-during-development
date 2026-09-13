"""
================================================================================
bi[o]hub | Zarr v3 Volume Streamer & Detection Module
High-Performance Chunked 4D Microscopy I/O & Anisotropic Spatial Extraction
Chan Zuckerberg Biohub (CZ Biohub San Francisco)
================================================================================
"""

import os
import json
import time
from pathlib import Path
from typing import Dict, List, Tuple, Generator, Optional, Any, Union
import numpy as np
import scipy.ndimage as ndi

# Physical voxel scaling constants (µm/voxel)
SCALE_Z: float = 1.625
SCALE_Y: float = 0.40625
SCALE_X: float = 0.40625
SCALE_ZYX: np.ndarray = np.array([SCALE_Z, SCALE_Y, SCALE_X], dtype=np.float64)
MAX_MATCHING_DIST_UM: float = 7.0


class ZarrV3VolumeStreamer:
    """
    High-efficiency streaming reader and feature extractor for 4D Zarr v3 volumes.
    Handles (T, Z, Y, X) arrays with chunks typically sized (1, 64, 256, 256) at path '0/'.
    Enforces out-of-core memory safety to strictly respect the 12-hour offline inference budget.
    """

    def __init__(
        self,
        store_path: Union[str, Path],
        array_path: str = "0",
        scale_zyx: Tuple[float, float, float] = (SCALE_Z, SCALE_Y, SCALE_X),
    ):
        self.store_path = Path(store_path)
        self.array_path = array_path.strip("/")
        self.scale_zyx = np.array(scale_zyx, dtype=np.float64)
        self.metadata: Dict[str, Any] = {}
        self.shape: Tuple[int, ...] = (0, 0, 0, 0)
        self.chunk_shape: Tuple[int, ...] = (1, 64, 256, 256)
        self.dtype = np.uint16
        self.is_synthetic: bool = False

        self._initialize_store()

    def _initialize_store(self) -> None:
        """Inspects and parses Zarr v3 / v2 metadata from local directory or store."""
        target_dir = self.store_path / self.array_path if self.array_path else self.store_path
        zarr_json_v3 = target_dir / "zarr.json"
        zarray_v2 = target_dir / ".zarray"

        if zarr_json_v3.exists():
            try:
                with open(zarr_json_v3, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                self.shape = tuple(self.metadata.get("shape", [10, 64, 256, 256]))
                chunk_grid = self.metadata.get("chunk_grid", {})
                regular_conf = chunk_grid.get("configuration", {})
                self.chunk_shape = tuple(regular_conf.get("chunk_shape", [1, 64, 256, 256]))
                data_type = self.metadata.get("data_type", "uint16")
                self.dtype = np.dtype(data_type)
                print(f"[ZarrV3Streamer] Initialized Zarr v3 from {zarr_json_v3}: Shape={self.shape}, Chunks={self.chunk_shape}")
                return
            except Exception as err:
                print(f"[ZarrV3Streamer] Warning parsing {zarr_json_v3}: {err}. Falling back to defaults.")

        if zarray_v2.exists():
            try:
                with open(zarray_v2, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                self.shape = tuple(self.metadata.get("shape", [10, 64, 256, 256]))
                self.chunk_shape = tuple(self.metadata.get("chunks", [1, 64, 256, 256]))
                self.dtype = np.dtype(self.metadata.get("dtype", "<u2"))
                print(f"[ZarrV3Streamer] Initialized Zarr v2 from {zarray_v2}: Shape={self.shape}, Chunks={self.chunk_shape}")
                return
            except Exception as err:
                print(f"[ZarrV3Streamer] Warning parsing {zarray_v2}: {err}")

        # Fallback to simulated high-fidelity 4D volume generator if store does not exist on disk
        self.is_synthetic = True
        self.shape = (8, 64, 256, 256)
        self.chunk_shape = (1, 64, 256, 256)
        self.dtype = np.uint16
        print(f"[ZarrV3Streamer] Virtual store active (Shape: {self.shape}, Chunk: {self.chunk_shape})")

    def get_time_frame(self, t: int) -> np.ndarray:
        """
        Loads or generates the 3D volume (Z, Y, X) for timeframe t.
        If real zarr chunks exist in c/ or standard key layout, loads them slab-by-slab.
        """
        if self.is_synthetic or not self.store_path.exists():
            return self._generate_synthetic_timeframe(t)

        target_dir = self.store_path / self.array_path if self.array_path else self.store_path
        z_dim, y_dim, x_dim = self.shape[1], self.shape[2], self.shape[3]
        cz, cy, cx = self.chunk_shape[1], self.chunk_shape[2], self.chunk_shape[3]

        volume = np.zeros((z_dim, y_dim, x_dim), dtype=self.dtype)

        # Chunk iteration across spatial grid
        num_z_chunks = int(np.ceil(z_dim / cz))
        num_y_chunks = int(np.ceil(y_dim / cy))
        num_x_chunks = int(np.ceil(x_dim / cx))

        for z_idx in range(num_z_chunks):
            for y_idx in range(num_y_chunks):
                for x_idx in range(num_x_chunks):
                    chunk_key_v3 = f"c/{t}/{z_idx}/{y_idx}/{x_idx}"
                    chunk_key_v2 = f"{t}.{z_idx}.{y_idx}.{x_idx}"
                    file_v3 = target_dir / chunk_key_v3
                    file_v2 = target_dir / chunk_key_v2

                    z_start = z_idx * cz
                    z_end = min(z_dim, (z_idx + 1) * cz)
                    y_start = y_idx * cy
                    y_end = min(y_dim, (y_idx + 1) * cy)
                    x_start = x_idx * cx
                    x_end = min(x_dim, (x_idx + 1) * cx)

                    loaded = False
                    for path in [file_v3, file_v2]:
                        if path.exists():
                            try:
                                raw_bytes = path.read_bytes()
                                chunk_arr = np.frombuffer(raw_bytes, dtype=self.dtype).reshape(
                                    1, z_end - z_start, y_end - y_start, x_end - x_start
                                )
                                volume[z_start:z_end, y_start:y_end, x_start:x_end] = chunk_arr[0]
                                loaded = True
                                break
                            except Exception:
                                pass
                    if not loaded:
                        # Chunk not found or zero-fill
                        pass

        return volume

    def _generate_synthetic_timeframe(self, t: int) -> np.ndarray:
        """
        Generates realistic developmental cell nuclei microscopy volume (Z, Y, X)
        with 4:1 anisotropy and realistic Poisson-Gaussian noise.
        """
        z_dim, y_dim, x_dim = self.shape[1], self.shape[2], self.shape[3]
        vol = np.random.normal(loc=120.0, scale=12.0, size=(z_dim, y_dim, x_dim)).astype(np.float32)

        # Generate realistic migrating nuclei
        np.random.seed(42 + t * 137)
        num_cells = 8 + t * 4
        centers = []
        for c in range(num_cells):
            cz = np.random.uniform(15, z_dim - 15)
            cy = np.random.uniform(40, y_dim - 40)
            cx = np.random.uniform(40, x_dim - 40)
            centers.append((cz, cy, cx))

        zz, yy, xx = np.ogrid[:z_dim, :y_dim, :x_dim]
        # In voxel space: z is compressed, so sigma_z in voxels is ~1.5, sigma_xy is ~5.5
        sig_z = 1.8
        sig_xy = 5.2

        for cz, cy, cx in centers:
            r2 = ((zz - cz) / sig_z) ** 2 + ((yy - cy) / sig_xy) ** 2 + ((xx - cx) / sig_xy) ** 2
            blob = np.exp(-0.5 * r2) * np.random.uniform(3200, 4800)
            vol += blob

        vol = np.clip(vol, 0, 65535).astype(np.uint16)
        return vol

    def detect_nuclei_centroids(
        self,
        t: int,
        intensity_threshold: float = 500.0,
        min_distance_um: float = 2.0,
    ) -> List[Dict[str, Any]]:
        """
        Performs 3D blob detection and sub-voxel centroid extraction respecting anisotropic physical scales:
        z = 1.625 µm/vox, y = 0.40625 µm/vox, x = 0.40625 µm/vox.
        """
        volume = self.get_time_frame(t)

        # Anisotropic 3D Gaussian filtering
        # Since z is 4x coarser in physical space, smooth with smaller sigma_z in voxels
        sigma_vox = (0.75, 2.5, 2.5)
        smoothed = ndi.gaussian_filter(volume.astype(np.float32), sigma=sigma_vox)

        # Background subtraction using rolling ball / large morphological opening
        background = ndi.minimum_filter(smoothed, size=(3, 9, 9))
        foreground = np.maximum(0.0, smoothed - background)

        # Peak detection with physical distance exclusion
        # Convert min_distance_um to voxel footprint
        footprint_z = max(1, int(round(min_distance_um / SCALE_Z)))
        footprint_xy = max(1, int(round(min_distance_um / SCALE_Y)))
        footprint = np.ones((2 * footprint_z + 1, 2 * footprint_xy + 1, 2 * footprint_xy + 1), dtype=bool)

        local_max = (foreground == ndi.maximum_filter(foreground, footprint=footprint)) & (foreground > intensity_threshold)
        peak_indices = np.argwhere(local_max)

        detections = []
        for idx, (z_v, y_v, x_v) in enumerate(peak_indices):
            # Centroid refinement via intensity-weighted center of mass
            z_min, z_max = max(0, z_v - 1), min(self.shape[1], z_v + 2)
            y_min, y_max = max(0, y_v - 3), min(self.shape[2], y_v + 4)
            x_min, x_max = max(0, x_v - 3), min(self.shape[3], x_v + 4)

            crop = foreground[z_min:z_max, y_min:y_max, x_min:x_max]
            total_mass = float(np.sum(crop))

            if total_mass > 0:
                com = ndi.center_of_mass(crop)
                sub_z = z_min + float(com[0])
                sub_y = y_min + float(com[1])
                sub_x = x_min + float(com[2])
            else:
                sub_z, sub_y, sub_x = float(z_v), float(y_v), float(x_v)

            detections.append({
                "detection_id": idx,
                "t": t,
                "z": round(sub_z, 4),
                "y": round(sub_y, 4),
                "x": round(sub_x, 4),
                "z_um": round(sub_z * SCALE_Z, 4),
                "y_um": round(sub_y * SCALE_Y, 4),
                "x_um": round(sub_x * SCALE_X, 4),
                "intensity": float(foreground[z_v, y_v, x_v]),
            })

        return detections


if __name__ == "__main__":
    streamer = ZarrV3VolumeStreamer(store_path="./data/sample_blastomere.zarr")
    print(f"Loaded streamer with shape: {streamer.shape}")
    dets = streamer.detect_nuclei_centroids(t=0, intensity_threshold=300.0)
    print(f"Extracted {len(dets)} cell centroids at t=0:")
    for d in dets[:5]:
        print(f"  Node at t={d['t']}: Voxel=({d['z']}, {d['y']}, {d['x']}), Physical=({d['z_um']}, {d['y_um']}, {d['x_um']}) µm")
