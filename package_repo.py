#!/usr/bin/env python3
"""
================================================================================
bi[o]hub | Standalone Offline Inference Packaging & Kaggle Exporter
Builds a sanitized, self-contained, zero-internet offline inference bundle
================================================================================
"""

import os
import sys
import glob
import json
import time
import shutil
import zipfile
import hashlib
import argparse
from pathlib import Path
from typing import List, Set, Dict, Any, Tuple, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Strict exclusion rules for repository sanitization
EXCLUSION_PATTERNS: Set[str] = {
    ".git",
    ".git/*",
    "__pycache__",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".coverage",
    "htmlcov",
    ".venv",
    "venv",
    "env",
    ".conda",
    "node_modules",
    "node_modules/*",
    "dist",
    "dist/*",
    "build",
    ".vscode",
    ".cursor",
    ".idea",
    "*.swp",
    "*.swo",
    "*.zarr",
    "*.zarr/*",
    "*.tif",
    "*.tiff",
    "*.pt",
    "*.pth",
    "*.ckpt",
    "*.bin",
    "*.h5",
    "*.parquet",
    "*.feather",
    "*.csv",
    "*.log",
}

# Explicit files and folders to package
INCLUDED_CORE_FILES: List[str] = [
    "inference_runner.py",
    "inference_entry.py",
    "zarr_io_streamer.py",
    "app.py",
]

INCLUDED_MODULE_DIRS: List[str] = [
    "detection",
    "tracking",
    "metrics",
    "utils",
]


def is_excluded(path: Path, root: Path) -> bool:
    """Checks whether a given file path matches any exclusion patterns."""
    rel_path = path.relative_to(root)
    parts = rel_path.parts

    # Exclude common directory names
    for part in parts:
        if part in {
            ".git",
            "__pycache__",
            ".pytest_cache",
            "venv",
            ".venv",
            "node_modules",
            "dist",
            ".vscode",
            ".cursor",
            ".idea"
        }:
            return True

    # Exclude by suffix
    suffix = path.suffix.lower()
    if suffix in {".pyc", ".pyo", ".pyd", ".zarr", ".tif", ".tiff", ".pt", ".pth", ".ckpt", ".log"}:
        return True

    # Exclude temporary submission CSVs generated during tests
    if path.name.endswith(".csv") and path.name != "dataset-metadata.json":
        return True

    return False


def generate_kaggle_metadata(
    output_dir: Path,
    kaggle_username: str = "your_kaggle_username",
    dataset_title: str = "biohub-tracking-src",
) -> Path:
    """
    Generates a valid Kaggle API dataset-metadata.json descriptor.
    """
    metadata_content: Dict[str, Any] = {
        "title": dataset_title,
        "id": f"{kaggle_username}/{dataset_title}",
        "licenses": [{"name": "CC0-1.0"}],
        "description": "bi[o]hub Cell Tracking During Development - Self-Contained Offline Inference Package",
        "keywords": ["biohub", "cell-tracking", "microscopy", "anisotropic-tracking", "hungarian-algorithm"],
        "collaborators": [],
        "data": []
    }

    metadata_path = output_dir / "dataset-metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata_content, f, indent=2)
    return metadata_path


def compute_sha256(filepath: Path) -> str:
    """Computes the cryptographic SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def run_preflight_verification() -> bool:
    """
    Executes pre-flight verification:
      1. Checks 4:1 anisotropy ratio (1.625 / 0.40625 == 4.0).
      2. Validates physical Euclidean distance invariants.
      3. Validates Hungarian 7.0 µm gating.
      4. Validates 10-column competition CSV schema & integer coordinate typing.
    """
    print("[PRE-FLIGHT] Running Verification Sanity Suite...")
    try:
        from inference_entry import run_self_test
        return run_self_test()
    except Exception as e:
        print(f"[FAIL] Pre-flight sanity tests failed: {e}")
        return False


def package_repository(
    kaggle_username: str = "your_kaggle_username",
    output_zip_name: str = "biohub_tracking_offline_pkg.zip",
    wheels_dir: Optional[str] = "wheels",
    skip_test: bool = False,
) -> Path:
    """
    Main packaging orchestrator:
      1. Runs pre-flight self-test.
      2. Assembles sanitized modules and wheels into staging area.
      3. Creates dataset-metadata.json for Kaggle API dataset upload.
      4. Compresses into clean ZIP archive.
      5. Emits SHA-256 fingerprint.
    """
    start_time = time.time()
    print("================================================================================")
    print("bi[o]hub | Packaging Zero-Internet Offline Kaggle Inference Bundle")
    print("================================================================================")

    # 1. Pre-flight sanity check
    if not skip_test:
        test_passed = run_preflight_verification()
        if not test_passed:
            raise RuntimeError("Pre-flight invariant tests failed! Aborting packaging to protect submission integrity.")

    staging_dir = PROJECT_ROOT / "_staging_pkg"
    if staging_dir.exists():
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] Staging sanitized package files into: {staging_dir}")

    packaged_files: List[Tuple[Path, str]] = []

    # Copy core Python modules
    for core_file in INCLUDED_CORE_FILES:
        src = PROJECT_ROOT / core_file
        if src.exists():
            dst = staging_dir / core_file
            shutil.copy2(src, dst)
            packaged_files.append((dst, core_file))
            print(f"       + Copied file: {core_file}")

    # Copy modular subdirectories (detection, tracking, metrics, utils)
    for mod_dir in INCLUDED_MODULE_DIRS:
        src_dir = PROJECT_ROOT / mod_dir
        if src_dir.exists() and src_dir.is_dir():
            dst_dir = staging_dir / mod_dir
            shutil.copytree(
                src_dir,
                dst_dir,
                ignore=lambda d, files: [f for f in files if is_excluded(Path(d) / f, PROJECT_ROOT)]
            )
            print(f"       + Copied module directory: {mod_dir}/")
            for sub_file in dst_dir.rglob("*.py"):
                rel = sub_file.relative_to(staging_dir)
                packaged_files.append((sub_file, str(rel)))

    # Copy pre-downloaded wheels if present
    whl_path = PROJECT_ROOT / (wheels_dir or "wheels")
    if whl_path.exists() and whl_path.is_dir():
        dst_wheels = staging_dir / "wheels"
        dst_wheels.mkdir(parents=True, exist_ok=True)
        wheel_count = 0
        for whl in whl_path.glob("*.whl"):
            shutil.copy2(whl, dst_wheels / whl.name)
            packaged_files.append((dst_wheels / whl.name, f"wheels/{whl.name}"))
            wheel_count += 1
        print(f"       + Bundled {wheel_count} pre-compiled wheel (.whl) files from {whl_path}")

    # Generate Kaggle Dataset metadata descriptor
    meta_path = generate_kaggle_metadata(staging_dir, kaggle_username=kaggle_username)
    packaged_files.append((meta_path, "dataset-metadata.json"))
    print(f"       + Created Kaggle dataset descriptor: dataset-metadata.json")

    # Compress into clean ZIP archive
    final_zip_path = PROJECT_ROOT / output_zip_name
    if final_zip_path.exists():
        final_zip_path.unlink()

    print(f"\n[INFO] Compresses sanitized bundle into: {final_zip_path.name}...")
    with zipfile.ZipFile(final_zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path, arcname in packaged_files:
            zipf.write(file_path, arcname=arcname)

    # Cleanup staging directory
    shutil.rmtree(staging_dir)

    # Compute bundle statistics
    file_size_mb = final_zip_path.stat().st_size / (1024.0 * 1024.0)
    file_size_kb = final_zip_path.stat().st_size / 1024.0
    sha256_hash = compute_sha256(final_zip_path)
    total_time = time.time() - start_time

    print("\n================================================================================")
    print("bi[o]hub | OFFLINE INFERENCE PACKAGE SUCCESSFULLY BUILT")
    print("================================================================================")
    print(f"Archive:      {final_zip_path.resolve()}")
    print(f"Archive Size: {file_size_mb:.2f} MB ({file_size_kb:.1f} KB)")
    print(f"Packaged:     {len(packaged_files)} items")
    print(f"SHA-256:      {sha256_hash}")
    print(f"Elapsed:      {total_time:.2f} seconds")
    print("--------------------------------------------------------------------------------")
    print("Kaggle Upload Directive:")
    print(f"  kaggle datasets create -p {final_zip_path.parent} -r zip")
    print("Kaggle Notebook Mounting Directive:")
    print("  import sys; sys.path.insert(0, '/kaggle/input/biohub-tracking-src')")
    print("  from inference_entry import run_inference; run_inference()")
    print("================================================================================\n")

    return final_zip_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="bi[o]hub Offline Package Generator")
    parser.add_argument("--username", type=str, default="your_kaggle_username", help="Kaggle account username for dataset metadata")
    parser.add_argument("--output", type=str, default="biohub_tracking_offline_pkg.zip", help="Output ZIP file name")
    parser.add_argument("--wheels", type=str, default="wheels", help="Directory containing pre-compiled .whl files")
    parser.add_argument("--skip-test", action="store_true", help="Skip pre-flight invariant self-tests")

    args = parser.parse_args()
    package_repository(
        kaggle_username=args.username,
        output_zip_name=args.output,
        wheels_dir=args.wheels,
        skip_test=args.skip_test,
    )
