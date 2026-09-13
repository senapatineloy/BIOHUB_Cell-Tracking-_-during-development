import { CellNode, CellEdge, PHYSICAL_SCALING } from '../types';
import { calculatePhysicalDistance } from '../utils/geoUtils';

/**
 * Realistic developmental microscopy synthetic benchmark dataset
 * Simulating blastomere lineage progression in physical coordinates.
 */
export function generateBenchmarkDataset(): {
  gtNodes: CellNode[];
  gtEdges: CellEdge[];
  predNodes: CellNode[];
  predEdges: CellEdge[];
} {
  const gtNodes: CellNode[] = [];
  const gtEdges: CellEdge[] = [];
  let rowId = 1;
  let nodeIdCounter = 100;
  let edgeIdCounter = 1;

  // Helper to add a ground truth node
  function addGtNode(
    t: number,
    z: number,
    y: number,
    x: number,
    trackId: number,
    opts: { isMother?: boolean; isDaughter?: boolean; idOverride?: number } = {}
  ): CellNode {
    const node: CellNode = {
      id: rowId++,
      dataset: 'blastomere_dev_01',
      row_type: 'node',
      node_id: opts.idOverride ?? nodeIdCounter++,
      t,
      z,
      y,
      x,
      source_id: -1,
      target_id: -1,
      z_um: Number((z * PHYSICAL_SCALING.VOXEL_Z).toFixed(3)),
      y_um: Number((y * PHYSICAL_SCALING.VOXEL_Y).toFixed(3)),
      x_um: Number((x * PHYSICAL_SCALING.VOXEL_X).toFixed(3)),
      track_id: trackId,
      is_division_mother: opts.isMother,
      is_division_daughter: opts.isDaughter,
    };
    gtNodes.push(node);
    return node;
  }

  function addGtEdge(src: CellNode, tgt: CellNode): CellEdge {
    const dist = calculatePhysicalDistance(src, tgt);
    const edge: CellEdge = {
      id: rowId++,
      dataset: 'blastomere_dev_01',
      row_type: 'edge',
      node_id: -1,
      t: -1,
      z: -1,
      y: -1,
      x: -1,
      source_id: src.node_id,
      target_id: tgt.node_id,
      physical_distance_um: Number(dist.toFixed(3)),
      is_division_edge: src.is_division_mother === true,
    };
    gtEdges.push(edge);
    return edge;
  }

  // --- Lineage 1: Stable migratory stem cell (t=0..4) ---
  const l1_t0 = addGtNode(0, 20.0, 100.0, 100.0, 1);
  const l1_t1 = addGtNode(1, 20.5, 102.0, 101.5, 1);
  const l1_t2 = addGtNode(2, 21.0, 104.5, 103.0, 1);
  const l1_t3 = addGtNode(3, 21.8, 107.0, 105.0, 1);
  const l1_t4 = addGtNode(4, 22.5, 110.0, 107.5, 1);
  addGtEdge(l1_t0, l1_t1);
  addGtEdge(l1_t1, l1_t2);
  addGtEdge(l1_t2, l1_t3);
  addGtEdge(l1_t3, l1_t4);

  // --- Lineage 2: Mitotic Division at t=2 -> 2 daughters at t=3, 4 ---
  const l2_t0 = addGtNode(0, 15.0, 70.0, 120.0, 2);
  const l2_t1 = addGtNode(1, 15.6, 72.0, 122.0, 2);
  const l2_t2 = addGtNode(2, 16.0, 74.0, 124.0, 2, { isMother: true }); // Mother
  // Daughter A
  const l2_d1_t3 = addGtNode(3, 14.5, 68.0, 128.0, 201, { isDaughter: true });
  const l2_d1_t4 = addGtNode(4, 13.8, 64.0, 131.0, 201);
  // Daughter B
  const l2_d2_t3 = addGtNode(3, 17.5, 80.0, 121.0, 202, { isDaughter: true });
  const l2_d2_t4 = addGtNode(4, 18.2, 85.0, 119.0, 202);
  addGtEdge(l2_t0, l2_t1);
  addGtEdge(l2_t1, l2_t2);
  addGtEdge(l2_t2, l2_d1_t3); // Division edge 1
  addGtEdge(l2_t2, l2_d2_t3); // Division edge 2
  addGtEdge(l2_d1_t3, l2_d1_t4);
  addGtEdge(l2_d2_t3, l2_d2_t4);

  // --- Lineage 3: Early Division at t=1 ---
  const l3_t0 = addGtNode(0, 28.0, 150.0, 80.0, 3);
  const l3_t1 = addGtNode(1, 28.8, 153.0, 83.0, 3, { isMother: true }); // Mother
  const l3_d1_t2 = addGtNode(2, 27.2, 147.0, 80.0, 301, { isDaughter: true });
  const l3_d1_t3 = addGtNode(3, 26.5, 143.0, 78.0, 301);
  const l3_d1_t4 = addGtNode(4, 25.8, 139.0, 76.0, 301);
  const l3_d2_t2 = addGtNode(2, 30.2, 160.0, 87.0, 302, { isDaughter: true });
  const l3_d2_t3 = addGtNode(3, 31.0, 165.0, 90.0, 302);
  const l3_d2_t4 = addGtNode(4, 31.5, 170.0, 93.0, 302);
  addGtEdge(l3_t0, l3_t1);
  addGtEdge(l3_t1, l3_d1_t2);
  addGtEdge(l3_t1, l3_d2_t2);
  addGtEdge(l3_d1_t2, l3_d1_t3);
  addGtEdge(l3_d1_t3, l3_d1_t4);
  addGtEdge(l3_d2_t2, l3_d2_t3);
  addGtEdge(l3_d2_t3, l3_d2_t4);

  // --- Lineage 4: Fast moving cell along Z-axis (anisotropic motion test) ---
  const l4_t0 = addGtNode(0, 35.0, 120.0, 160.0, 4);
  const l4_t1 = addGtNode(1, 36.8, 121.0, 161.0, 4); // dz=1.8 vox = 2.925 µm
  const l4_t2 = addGtNode(2, 38.5, 122.5, 162.0, 4); // dz=1.7 vox = 2.76 µm
  const l4_t3 = addGtNode(3, 40.2, 124.0, 163.0, 4);
  const l4_t4 = addGtNode(4, 42.0, 125.5, 164.0, 4);
  addGtEdge(l4_t0, l4_t1);
  addGtEdge(l4_t1, l4_t2);
  addGtEdge(l4_t2, l4_t3);
  addGtEdge(l4_t3, l4_t4);

  // --- Lineage 5: Proximity cluster (near Lineage 1, testing identity switch risk) ---
  const l5_t0 = addGtNode(0, 21.0, 108.0, 110.0, 5);
  const l5_t1 = addGtNode(1, 21.4, 110.0, 112.0, 5);
  const l5_t2 = addGtNode(2, 22.0, 113.0, 114.0, 5);
  const l5_t3 = addGtNode(3, 22.7, 115.5, 116.5, 5);
  const l5_t4 = addGtNode(4, 23.3, 118.0, 119.0, 5);
  addGtEdge(l5_t0, l5_t1);
  addGtEdge(l5_t1, l5_t2);
  addGtEdge(l5_t2, l5_t3);
  addGtEdge(l5_t3, l5_t4);

  // Generate a high-performing predicted set with small detection jitter (0.2-0.5 µm)
  const predNodes: CellNode[] = [];
  const predEdges: CellEdge[] = [];
  let predRowId = 10000;
  let predNodeIdCounter = 5000;
  const gtToPredMap = new Map<number, number>();

  for (const gn of gtNodes) {
    // Add realistic 3D localization jitter (~0.15 voxel)
    const jitterZ = (Math.sin(gn.node_id * 1.3) * 0.12);
    const jitterY = (Math.cos(gn.node_id * 1.7) * 0.35);
    const jitterX = (Math.sin(gn.node_id * 2.1) * 0.35);

    const pNodeId = predNodeIdCounter++;
    gtToPredMap.set(gn.node_id, pNodeId);

    const pz = gn.z + jitterZ;
    const py = gn.y + jitterY;
    const px = gn.x + jitterX;

    predNodes.push({
      id: predRowId++,
      dataset: gn.dataset,
      row_type: 'node',
      node_id: pNodeId,
      t: gn.t,
      z: Number(pz.toFixed(3)),
      y: Number(py.toFixed(3)),
      x: Number(px.toFixed(3)),
      source_id: -1,
      target_id: -1,
      z_um: Number((pz * PHYSICAL_SCALING.VOXEL_Z).toFixed(3)),
      y_um: Number((py * PHYSICAL_SCALING.VOXEL_Y).toFixed(3)),
      x_um: Number((px * PHYSICAL_SCALING.VOXEL_X).toFixed(3)),
      track_id: gn.track_id,
      confidence: 0.94 + (Math.sin(gn.node_id) * 0.05),
    });
  }

  // Edge predictions matching the ground truth edges
  for (const ge of gtEdges) {
    const pSrc = gtToPredMap.get(ge.source_id)!;
    const pTgt = gtToPredMap.get(ge.target_id)!;
    const srcNode = predNodes.find(n => n.node_id === pSrc)!;
    const tgtNode = predNodes.find(n => n.node_id === pTgt)!;
    const dist = calculatePhysicalDistance(srcNode, tgtNode);

    predEdges.push({
      id: predRowId++,
      dataset: ge.dataset,
      row_type: 'edge',
      node_id: -1,
      t: -1,
      z: -1,
      y: -1,
      x: -1,
      source_id: pSrc,
      target_id: pTgt,
      physical_distance_um: Number(dist.toFixed(3)),
    });
  }

  return { gtNodes, gtEdges, predNodes, predEdges };
}

/**
 * Exports nodes and edges to exact Kaggle submission CSV format
 */
export function exportToSubmissionCsv(nodes: CellNode[], edges: CellEdge[]): string {
  const header = 'id,dataset,row_type,node_id,t,z,y,x,source_id,target_id';
  const lines: string[] = [header];

  let currentId = 0;

  // Add node rows
  for (const n of nodes) {
    lines.push(
      `${currentId++},${n.dataset},node,${n.node_id},${n.t},${n.z.toFixed(4)},${n.y.toFixed(4)},${n.x.toFixed(4)},-1,-1`
    );
  }

  // Add edge rows
  for (const e of edges) {
    lines.push(
      `${currentId++},${e.dataset},edge,-1,-1,-1.0,-1.0,-1.0,${e.source_id},${e.target_id}`
    );
  }

  return lines.join('\n');
}
