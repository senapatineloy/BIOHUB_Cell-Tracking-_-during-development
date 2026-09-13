/**
 * bi[o]hub - Cell Tracking During Development
 * Core Types, Technical Constraints & Brand Tokens.
 */

export const BIOHUB_BRAND = {
  PRIMARY_ACCENT: '#6A45FF',   // Electric Violet
  DARK_NEUTRAL: '#181528',     // Charcoal Violet
  MID_ACCENT: '#A259FF',       // Amethyst
  SURFACE_CONTAINER: '#F0EDFF',// Soft Purple
  SUBDUED_TEXT: '#A5A1B8',     // Muted Violet
  CARD_BG: '#1F1A35',          // Deep Slate Violet
  CARD_BORDER: '#352C58',      // Inset Border
} as const;

export const ZARR_V3_SPEC = {
  ARRAY_PATH: '0/',
  CHUNK_SHAPE: [1, 64, 256, 256] as const, // (T, Z, Y, X)
  DTYPE: 'uint16' as const,
  RAW_BIT_DEPTH: 16,
} as const;

export const PHYSICAL_SCALING = {
  VOXEL_Z: 1.625,    // µm per voxel
  VOXEL_Y: 0.40625,  // µm per voxel
  VOXEL_X: 0.40625,  // µm per voxel
  ANISOTROPY_RATIO: 4.0, // z is 4x coarser than x/y (1.625 / 0.40625)
  MAX_MATCHING_DISTANCE_UM: 7.0, // Max Euclidean distance in physical space
  DIVISION_WEIGHT: 0.1, // Metric weight for Division Jaccard
  MAX_OFFLINE_HOURS: 12, // Kaggle offline runtime budget
} as const;

export type RowType = 'node' | 'edge';

export interface CellNode {
  id: number;
  dataset: string;
  row_type: 'node';
  node_id: number;
  t: number;
  z: number; // voxel coordinate
  y: number; // voxel coordinate
  x: number; // voxel coordinate
  source_id: -1;
  target_id: -1;
  // Computed physical coordinates (µm)
  z_um?: number;
  y_um?: number;
  x_um?: number;
  // Metadata for visualization & matching
  track_id?: number;
  is_division_mother?: boolean;
  is_division_daughter?: boolean;
  confidence?: number;
}

export interface CellEdge {
  id: number;
  dataset: string;
  row_type: 'edge';
  node_id: -1;
  t: -1;
  z: -1;
  y: -1;
  x: -1;
  source_id: number; // parent node_id
  target_id: number; // daughter node_id
  // Computed properties
  physical_distance_um?: number;
  is_division_edge?: boolean;
}

export type SubmissionRow = CellNode | CellEdge;

export interface OverPredictionAnalysis {
  estimatedNumberOfNodes: number;
  predictedNodeCount: number;
  ratio: number; // predicted / estimated
  penaltyFactor: number;
  adjustedEdgeJaccardWithPenalty: number;
  isSevereOverprediction: boolean;
}

export interface MetricEvaluationResult {
  nodeMatches: {
    tpNodes: number;
    fpNodes: number;
    fnNodes: number;
    nodeJaccard: number;
  };
  edgeMetrics: {
    tpEdges: number;
    fpEdges: number;
    fnEdges: number;
    rawEdgeJaccard: number;
    adjustedEdgeJaccard: number;
  };
  divisionMetrics: {
    tpDivisions: number;
    fpDivisions: number;
    fnDivisions: number;
    divisionJaccard: number;
  };
  overPredictionAnalysis?: OverPredictionAnalysis;
  combinedScore: number;
  matchedPairs: Array<{ gtNodeId: number; predNodeId: number; distUm: number; t: number }>;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  rowId?: number;
}

export interface ValidationReport {
  isValid: boolean;
  totalRows: number;
  nodeCount: number;
  edgeCount: number;
  divisionCount: number;
  timeSpan: [number, number];
  issues: ValidationIssue[];
  maxPhysicalDistance: number;
  meanPhysicalDistance: number;
}

