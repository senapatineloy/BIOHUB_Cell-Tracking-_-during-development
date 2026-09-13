import React, { useState, useMemo } from 'react';
import { CellNode, CellEdge, ValidationReport, ValidationIssue, PHYSICAL_SCALING } from '../types';
import { calculatePhysicalDistance } from '../utils/geoUtils';
import { exportToSubmissionCsv } from '../data/mockDataset';
import { FileCheck, AlertTriangle, CheckCircle2, Download, Upload, Copy, RefreshCw } from 'lucide-react';

interface SubmissionInspectorProps {
  nodes: CellNode[];
  edges: CellEdge[];
}

export const SubmissionInspector: React.FC<SubmissionInspectorProps> = ({ nodes, edges }) => {
  const [csvContent, setCsvContent] = useState<string>(() => exportToSubmissionCsv(nodes, edges));
  const [copied, setCopied] = useState<boolean>(false);

  // Sync CSV if parent nodes or edges change
  const handleRegenerateFromLive = () => {
    const fresh = exportToSubmissionCsv(nodes, edges);
    setCsvContent(fresh);
  };

  // Comprehensive validator engine
  const report: ValidationReport = useMemo(() => {
    const lines = csvContent.trim().split('\n');
    const issues: ValidationIssue[] = [];
    const expectedHeader = 'id,dataset,row_type,node_id,t,z,y,x,source_id,target_id';

    if (lines.length === 0 || lines[0].trim() !== expectedHeader) {
      issues.push({
        severity: 'error',
        code: 'INVALID_HEADER',
        message: `Header must strictly be: ${expectedHeader}`,
      });
      return {
        isValid: false,
        totalRows: lines.length,
        nodeCount: 0,
        edgeCount: 0,
        divisionCount: 0,
        timeSpan: [0, 0],
        issues,
        maxPhysicalDistance: 0,
        meanPhysicalDistance: 0,
      };
    }

    const nodeCoords = new Map<number, { z: number; y: number; x: number; t: number }>();
    const nodeIds = new Set<number>();
    const outDegree = new Map<number, number>();
    const inDegree = new Map<number, number>();

    let nodeCount = 0;
    let edgeCount = 0;
    let minT = Infinity;
    let maxT = -Infinity;
    const edgeDistances: number[] = [];

    // First pass: Index all nodes
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length !== 10) {
        issues.push({
          severity: 'error',
          code: 'COLUMN_COUNT',
          message: `Line ${i + 1} has ${parts.length} columns (expected 10).`,
          rowId: i,
        });
        continue;
      }

      const [idStr, dataset, rowType, nodeIdStr, tStr, zStr, yStr, xStr, srcStr, tgtStr] = parts;
      const rowTypeClean = rowType.trim();

      if (rowTypeClean === 'node') {
        nodeCount++;
        const nodeId = parseInt(nodeIdStr);
        const t = parseInt(tStr);
        const z = parseFloat(zStr);
        const y = parseFloat(yStr);
        const x = parseFloat(xStr);
        const src = parseInt(srcStr);
        const tgt = parseInt(tgtStr);

        if (isNaN(nodeId)) {
          issues.push({ severity: 'error', code: 'INVALID_NODE_ID', message: `Invalid node_id at line ${i + 1}`, rowId: i });
        } else {
          nodeIds.add(nodeId);
          nodeCoords.set(nodeId, { z, y, x, t });
        }

        minT = Math.min(minT, t);
        maxT = Math.max(maxT, t);

        // Sentinel check
        if (src !== -1 || tgt !== -1) {
          issues.push({
            severity: 'error',
            code: 'SENTINEL_VIOLATION',
            message: `Node row must have source_id=-1 and target_id=-1 (got src=${src}, tgt=${tgt})`,
            rowId: i,
          });
        }
      } else if (rowTypeClean === 'edge') {
        edgeCount++;
        const nodeId = parseInt(nodeIdStr);
        const t = parseInt(tStr);
        const z = parseFloat(zStr);
        const y = parseFloat(yStr);
        const x = parseFloat(xStr);

        if (nodeId !== -1 || t !== -1 || z !== -1 || y !== -1 || x !== -1) {
          issues.push({
            severity: 'error',
            code: 'EDGE_SENTINEL_VIOLATION',
            message: `Edge row must have node_id, t, z, y, x set to -1`,
            rowId: i,
          });
        }
      }
    }

    // Second pass: Validate edges
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length !== 10 || parts[2].trim() !== 'edge') continue;

      const src = parseInt(parts[8]);
      const tgt = parseInt(parts[9]);

      // Check referential integrity
      const srcData = nodeCoords.get(src);
      const tgtData = nodeCoords.get(tgt);

      if (!srcData) {
        issues.push({
          severity: 'error',
          code: 'DANGLING_SOURCE_EDGE',
          message: `Edge references missing source_id: ${src}`,
          rowId: i,
        });
      }
      if (!tgtData) {
        issues.push({
          severity: 'error',
          code: 'DANGLING_TARGET_EDGE',
          message: `Edge references missing target_id: ${tgt}`,
          rowId: i,
        });
      }

      if (srcData && tgtData) {
        // Temporal direction check
        if (tgtData.t !== srcData.t + 1) {
          issues.push({
            severity: 'error',
            code: 'TEMPORAL_VIOLATION',
            message: `Edge connects non-consecutive frames: t=${srcData.t} -> t=${tgtData.t}`,
            rowId: i,
          });
        }

        // Physical distance calculation
        const dist = calculatePhysicalDistance(srcData, tgtData);
        edgeDistances.push(dist);

        if (dist > PHYSICAL_SCALING.MAX_MATCHING_DISTANCE_UM) {
          issues.push({
            severity: 'warning',
            code: 'DISTANCE_EXCEEDED',
            message: `Edge (${src}->${tgt}) physical length ${dist.toFixed(2)}µm exceeds 7.0µm bipartite cutoff!`,
            rowId: i,
          });
        }

        // Degree updates
        outDegree.set(src, (outDegree.get(src) || 0) + 1);
        inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
      }
    }

    // Biological Degree Constraints
    let divisionCount = 0;
    for (const [src, count] of outDegree.entries()) {
      if (count === 2) divisionCount++;
      if (count > 2) {
        issues.push({
          severity: 'error',
          code: 'EXCESS_OUT_DEGREE',
          message: `Node ${src} has out-degree ${count} (>2 is biologically impossible in mitosis).`,
        });
      }
    }

    for (const [tgt, count] of inDegree.entries()) {
      if (count > 1) {
        issues.push({
          severity: 'error',
          code: 'CELL_FUSION_VIOLATION',
          message: `Node ${tgt} has in-degree ${count} (>1 implies cell fusion).`,
        });
      }
    }

    const maxDist = edgeDistances.length > 0 ? Math.max(...edgeDistances) : 0;
    const meanDist = edgeDistances.length > 0
      ? edgeDistances.reduce((a, b) => a + b, 0) / edgeDistances.length
      : 0;

    const hasErrors = issues.some(iss => iss.severity === 'error');

    return {
      isValid: !hasErrors,
      totalRows: lines.length - 1,
      nodeCount,
      edgeCount,
      divisionCount,
      timeSpan: [minT === Infinity ? 0 : minT, maxT === -Infinity ? 0 : maxT],
      issues,
      maxPhysicalDistance: maxDist,
      meanPhysicalDistance: meanDist,
    };
  }, [csvContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submission.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        setCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col bg-[#181528] rounded-xl border border-[#352C58] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#1F1A35] border-b border-[#352C58]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#6A45FF]/20 border border-[#6A45FF]/40 text-[#A259FF]">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white flex items-center gap-2">
              bi<span className="text-[#6A45FF]">[</span>o<span className="text-[#6A45FF]">]</span>hub Submission Invariant Engine
              {report.isValid ? (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Validated Schema
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Validation Errors
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#251E3D] hover:bg-[#322954] text-[#F0EDFF] text-xs font-medium cursor-pointer transition-colors border border-[#483B75]">
            <Upload className="w-3.5 h-3.5 text-[#A259FF]" />
            Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={handleRegenerateFromLive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#251E3D] hover:bg-[#322954] text-[#F0EDFF] text-xs font-medium transition-colors border border-[#483B75]"
            title="Reload from benchmark simulation"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#A259FF]" />
            Sync Simulation
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#251E3D] hover:bg-[#322954] text-[#F0EDFF] text-xs font-medium transition-colors border border-[#483B75]"
          >
            <Copy className="w-3.5 h-3.5 text-[#A259FF]" />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#6A45FF] hover:bg-[#7D5CFF] text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download submission.csv
          </button>
        </div>
      </div>

      {/* Validation KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-4 bg-[#141122] border-b border-[#352C58] text-xs font-mono">
        <div className="p-2 rounded bg-[#1F1A35] border border-[#352C58]">
          <div className="text-[10px] text-[#A5A1B8] font-sans">Total Rows</div>
          <div className="text-sm font-bold text-white">{report.totalRows}</div>
        </div>
        <div className="p-2 rounded bg-[#1F1A35] border border-[#352C58]">
          <div className="text-[10px] text-[#A5A1B8] font-sans">Nodes ('node')</div>
          <div className="text-sm font-bold text-[#A259FF]">{report.nodeCount}</div>
        </div>
        <div className="p-2 rounded bg-[#1F1A35] border border-[#352C58]">
          <div className="text-[10px] text-[#A5A1B8] font-sans">Edges ('edge')</div>
          <div className="text-sm font-bold text-emerald-400">{report.edgeCount}</div>
        </div>
        <div className="p-2 rounded bg-[#1F1A35] border border-[#352C58]">
          <div className="text-[10px] text-[#A5A1B8] font-sans">Divisions (out=2)</div>
          <div className="text-sm font-bold text-amber-400">{report.divisionCount}</div>
        </div>
        <div className="p-2 rounded bg-[#1F1A35] border border-[#352C58]">
          <div className="text-[10px] text-[#A5A1B8] font-sans">Mean Edge &micro;m</div>
          <div className="text-sm font-bold text-[#F0EDFF]">{report.meanPhysicalDistance.toFixed(2)} µm</div>
        </div>
        <div className="p-2 rounded bg-[#1F1A35] border border-[#352C58]">
          <div className="text-[10px] text-[#A5A1B8] font-sans">Max Edge &micro;m</div>
          <div className={`text-sm font-bold ${report.maxPhysicalDistance > 7.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {report.maxPhysicalDistance.toFixed(2)} µm
          </div>
        </div>
      </div>

      {/* Issues list if any */}
      {report.issues.length > 0 && (
        <div className="p-3 bg-rose-950/20 border-b border-rose-800/40 text-xs space-y-1.5 max-h-36 overflow-y-auto">
          {report.issues.map((iss, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 ${
                iss.severity === 'error' ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong className="font-mono">[{iss.code}]</strong> {iss.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CSV Content Editor / Viewer */}
      <div className="p-4 bg-[#0F0C18]">
        <div className="flex items-center justify-between pb-2 text-xs text-[#A5A1B8] font-mono">
          <span>Schema: id,dataset,row_type,node_id,t,z,y,x,source_id,target_id</span>
          <span>Editable text area</span>
        </div>
        <textarea
          value={csvContent}
          onChange={e => setCsvContent(e.target.value)}
          rows={12}
          className="w-full bg-[#181528] border border-[#352C58] rounded-lg p-3 font-mono text-xs text-[#F0EDFF] focus:outline-none focus:border-[#6A45FF] leading-relaxed resize-y select-text"
          placeholder="Paste or edit submission CSV here..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};
