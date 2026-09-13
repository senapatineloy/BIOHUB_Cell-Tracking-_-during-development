import { PHYSICAL_SCALING } from '../types';

/**
 * Converts voxel coordinates (z, y, x) to physical coordinates (µm).
 */
export function voxelToPhysical(z: number, y: number, x: number): [number, number, number] {
  return [
    z * PHYSICAL_SCALING.VOXEL_Z,
    y * PHYSICAL_SCALING.VOXEL_Y,
    x * PHYSICAL_SCALING.VOXEL_X,
  ];
}

/**
 * Converts physical coordinates (µm) back to voxel coordinates.
 */
export function physicalToVoxel(z_um: number, y_um: number, x_um: number): [number, number, number] {
  return [
    z_um / PHYSICAL_SCALING.VOXEL_Z,
    y_um / PHYSICAL_SCALING.VOXEL_Y,
    x_um / PHYSICAL_SCALING.VOXEL_X,
  ];
}

/**
 * Computes exact Euclidean distance in physical space (µm) between two voxel coordinate vectors.
 */
export function calculatePhysicalDistance(
  posA: { z: number; y: number; x: number },
  posB: { z: number; y: number; x: number }
): number {
  const dz = (posA.z - posB.z) * PHYSICAL_SCALING.VOXEL_Z;
  const dy = (posA.y - posB.y) * PHYSICAL_SCALING.VOXEL_Y;
  const dx = (posA.x - posB.x) * PHYSICAL_SCALING.VOXEL_X;
  return Math.sqrt(dz * dz + dy * dy + dx * dx);
}

/**
 * Computes the anisotropic distance matrix between two sets of voxel points.
 */
export function computeDistanceMatrix(
  ptsA: Array<{ z: number; y: number; x: number }>,
  ptsB: Array<{ z: number; y: number; x: number }>
): number[][] {
  const n = ptsA.length;
  const m = ptsB.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      matrix[i][j] = calculatePhysicalDistance(ptsA[i], ptsB[j]);
    }
  }

  return matrix;
}
