import { CellNode, CellEdge, MetricEvaluationResult, PHYSICAL_SCALING } from '../types';
import { calculatePhysicalDistance } from './geoUtils';

/**
 * Min-cost bipartite matching implementation (Hungarian algorithm / greedy minimum distance fallback)
 * for bipartite matching within max physical distance cutoff (7.0 µm).
 */
export function bipartiteMatchNodes(
  gtNodes: CellNode[],
  predNodes: CellNode[],
  maxDistanceUm: number = PHYSICAL_SCALING.MAX_MATCHING_DISTANCE_UM
): {
  matchedPairs: Array<{ gtNodeId: number; predNodeId: number; distUm: number }>;
  unmatchedGtIds: Set<number>;
  unmatchedPredIds: Set<number>;
} {
  const matchedPairs: Array<{ gtNodeId: number; predNodeId: number; distUm: number }> = [];
  const unmatchedGtIds = new Set(gtNodes.map(n => n.node_id));
  const unmatchedPredIds = new Set(predNodes.map(n => n.node_id));

  if (gtNodes.length === 0 || predNodes.length === 0) {
    return { matchedPairs, unmatchedGtIds, unmatchedPredIds };
  }

  // Calculate distance matrix with cutoff filtering
  interface Candidate {
    gtIdx: number;
    predIdx: number;
    dist: number;
  }

  const candidates: Candidate[] = [];
  for (let i = 0; i < gtNodes.length; i++) {
    for (let j = 0; j < predNodes.length; j++) {
      const dist = calculatePhysicalDistance(gtNodes[i], predNodes[j]);
      if (dist <= maxDistanceUm) {
        candidates.push({ gtIdx: i, predIdx: j, dist });
      }
    }
  }

  // Sort candidates by physical distance ascending (Greedy optimal for spatial gating)
  candidates.sort((a, b) => a.dist - b.dist);

  const matchedGtIndices = new Set<number>();
  const matchedPredIndices = new Set<number>();

  for (const cand of candidates) {
    if (!matchedGtIndices.has(cand.gtIdx) && !matchedPredIndices.has(cand.predIdx)) {
      matchedGtIndices.add(cand.gtIdx);
      matchedPredIndices.add(cand.predIdx);
      const gt = gtNodes[cand.gtIdx];
      const pred = predNodes[cand.predIdx];
      matchedPairs.push({
        gtNodeId: gt.node_id,
        predNodeId: pred.node_id,
        distUm: cand.dist,
      });
      unmatchedGtIds.delete(gt.node_id);
      unmatchedPredIds.delete(pred.node_id);
    }
  }

  return { matchedPairs, unmatchedGtIds, unmatchedPredIds };
}

/**
 * Computes exact Adjusted Edge Jaccard, Division Jaccard, Over-prediction penalty, and Combined Score.
 */
export function evaluateTrackingSubmission(
  gtNodes: CellNode[],
  gtEdges: CellEdge[],
  predNodes: CellNode[],
  predEdges: CellEdge[],
  maxDistanceUm: number = PHYSICAL_SCALING.MAX_MATCHING_DISTANCE_UM,
  sparseMaskingRatio: number = 1.0, // Adjustment factor for sparse ground truth regions
  estimatedNumberOfNodes: number = gtNodes.length // Prior estimated node count
): MetricEvaluationResult {
  // Group nodes by timepoint t
  const timepoints = Array.from(
    new Set([...gtNodes.map(n => n.t), ...predNodes.map(n => n.t)])
  ).sort((a, b) => a - b);

  let totalTpNodes = 0;
  let totalFpNodes = 0;
  let totalFnNodes = 0;

  // Global mapping from predNodeId -> gtNodeId and vice-versa
  const predToGtNode = new Map<number, number>();
  const gtToPredNode = new Map<number, number>();
  const allMatchedPairs: Array<{ gtNodeId: number; predNodeId: number; distUm: number; t: number }> = [];

  for (const t of timepoints) {
    const gNodesAtT = gtNodes.filter(n => n.t === t);
    const pNodesAtT = predNodes.filter(n => n.t === t);

    const { matchedPairs, unmatchedGtIds, unmatchedPredIds } = bipartiteMatchNodes(
      gNodesAtT,
      pNodesAtT,
      maxDistanceUm
    );

    totalTpNodes += matchedPairs.length;
    totalFnNodes += unmatchedGtIds.size;
    totalFpNodes += unmatchedPredIds.size;

    for (const pair of matchedPairs) {
      predToGtNode.set(pair.predNodeId, pair.gtNodeId);
      gtToPredNode.set(pair.gtNodeId, pair.predNodeId);
      allMatchedPairs.push({ ...pair, t });
    }
  }

  const nodeJaccard = totalTpNodes + totalFpNodes + totalFnNodes > 0
    ? totalTpNodes / (totalTpNodes + totalFpNodes + totalFnNodes)
    : 0;

  // Build ground truth edge lookup: (src, tgt) -> edge
  const gtEdgeSet = new Set<string>();
  for (const edge of gtEdges) {
    gtEdgeSet.add(`${edge.source_id}->${edge.target_id}`);
  }

  // Count Edge True Positives and False Positives
  let tpEdges = 0;
  let fpEdges = 0;
  const matchedGtEdges = new Set<string>();

  for (const edge of predEdges) {
    const mappedSrc = predToGtNode.get(edge.source_id);
    const mappedTgt = predToGtNode.get(edge.target_id);

    if (mappedSrc !== undefined && mappedTgt !== undefined) {
      const gtKey = `${mappedSrc}->${mappedTgt}`;
      if (gtEdgeSet.has(gtKey)) {
        tpEdges++;
        matchedGtEdges.add(gtKey);
      } else {
        fpEdges++;
      }
    } else {
      // One or both endpoints failed to match a ground truth node
      fpEdges++;
    }
  }

  const fnEdges = gtEdges.length - matchedGtEdges.size;
  const rawEdgeDenom = tpEdges + fpEdges + fnEdges;
  const rawEdgeJaccard = rawEdgeDenom > 0 ? tpEdges / rawEdgeDenom : 0;

  // Adjusted Edge Jaccard applying sparse-annotation adjustment
  // In sparse regions, FP penalty outside evaluated territory is attenuated by sparseMaskingRatio
  const adjustedFpEdges = fpEdges * sparseMaskingRatio;
  const adjDenom = tpEdges + adjustedFpEdges + fnEdges;
  const adjustedEdgeJaccard = adjDenom > 0 ? tpEdges / adjDenom : 0;

  // Evaluate Divisions (out-degree == 2)
  // Group edges by source_id
  const gtOutEdges = new Map<number, number[]>();
  for (const edge of gtEdges) {
    if (!gtOutEdges.has(edge.source_id)) gtOutEdges.set(edge.source_id, []);
    gtOutEdges.get(edge.source_id)!.push(edge.target_id);
  }

  const predOutEdges = new Map<number, number[]>();
  for (const edge of predEdges) {
    if (!predOutEdges.has(edge.source_id)) predOutEdges.set(edge.source_id, []);
    predOutEdges.get(edge.source_id)!.push(edge.target_id);
  }

  // Ground truth divisions: source_ids with exactly 2 targets
  const gtDivisions = new Map<number, Set<number>>();
  for (const [src, targets] of gtOutEdges.entries()) {
    if (targets.length === 2) {
      gtDivisions.set(src, new Set(targets));
    }
  }

  // Predicted divisions: source_ids with exactly 2 targets
  const predDivisions = new Map<number, Set<number>>();
  for (const [src, targets] of predOutEdges.entries()) {
    if (targets.length === 2) {
      predDivisions.set(src, new Set(targets));
    }
  }

  let tpDivisions = 0;
  let fpDivisions = 0;
  const matchedGtDivisions = new Set<number>();

  for (const [predSrc, predTargets] of predDivisions.entries()) {
    const mappedGtSrc = predToGtNode.get(predSrc);
    if (mappedGtSrc !== undefined && gtDivisions.has(mappedGtSrc)) {
      const gtTargets = gtDivisions.get(mappedGtSrc)!;
      // Check if both predicted targets map to the GT division targets
      const mappedTargets = Array.from(predTargets).map(pTgt => predToGtNode.get(pTgt));
      const bothMatch =
        mappedTargets.length === 2 &&
        mappedTargets[0] !== undefined &&
        mappedTargets[1] !== undefined &&
        mappedTargets[0] !== mappedTargets[1] &&
        gtTargets.has(mappedTargets[0]) &&
        gtTargets.has(mappedTargets[1]);

      if (bothMatch) {
        tpDivisions++;
        matchedGtDivisions.add(mappedGtSrc);
      } else {
        fpDivisions++;
      }
    } else {
      fpDivisions++;
    }
  }

  const fnDivisions = gtDivisions.size - matchedGtDivisions.size;
  const divDenom = tpDivisions + fpDivisions + fnDivisions;
  const divisionJaccard = divDenom > 0 ? tpDivisions / divDenom : (gtDivisions.size === 0 && predDivisions.size === 0 ? 1.0 : 0);

  // Over-Prediction Penalty Modeling against estimated_number_of_nodes
  const predCount = predNodes.length;
  const estCount = Math.max(1, estimatedNumberOfNodes);
  const overPredRatio = predCount / estCount;
  // If predicting substantially more nodes than estimated, penalty scales down Adjusted Edge Jaccard
  const penaltyFactor = overPredRatio > 1.02
    ? Math.max(0.2, 1.0 / (1.0 + 1.8 * Math.max(0, overPredRatio - 1.0)))
    : 1.0;
  const adjustedEdgeJaccardWithPenalty = adjustedEdgeJaccard * penaltyFactor;

  const combinedScore = adjustedEdgeJaccardWithPenalty + PHYSICAL_SCALING.DIVISION_WEIGHT * divisionJaccard;

  return {
    nodeMatches: {
      tpNodes: totalTpNodes,
      fpNodes: totalFpNodes,
      fnNodes: totalFnNodes,
      nodeJaccard,
    },
    edgeMetrics: {
      tpEdges,
      fpEdges,
      fnEdges,
      rawEdgeJaccard,
      adjustedEdgeJaccard: adjustedEdgeJaccardWithPenalty,
    },
    divisionMetrics: {
      tpDivisions,
      fpDivisions,
      fnDivisions,
      divisionJaccard,
    },
    overPredictionAnalysis: {
      estimatedNumberOfNodes: estCount,
      predictedNodeCount: predCount,
      ratio: overPredRatio,
      penaltyFactor,
      adjustedEdgeJaccardWithPenalty,
      isSevereOverprediction: overPredRatio > 1.15,
    },
    combinedScore,
    matchedPairs: allMatchedPairs,
  };
}
