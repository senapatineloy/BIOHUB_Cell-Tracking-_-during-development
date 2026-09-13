import React, { useMemo } from 'react';
import { CellNode, CellEdge, BIOHUB_BRAND } from '../types';
import { GitCommit, GitBranch, Zap, Crosshair } from 'lucide-react';

interface LineageDendrogramProps {
  nodes: CellNode[];
  edges: CellEdge[];
  currentTime: number;
  onTimeChange: (t: number) => void;
  selectedNodeId: number | null;
  onSelectNodeId: (id: number | null) => void;
  ancestorNodeIds: Set<number>;
  progenyNodeIds: Set<number>;
  maxTime: number;
}

export const LineageDendrogram: React.FC<LineageDendrogramProps> = ({
  nodes,
  edges,
  currentTime,
  onTimeChange,
  selectedNodeId,
  onSelectNodeId,
  ancestorNodeIds,
  progenyNodeIds,
  maxTime,
}) => {
  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 440;
  const padding = { top: 40, bottom: 40, left: 60, right: 30 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Build map of nodes
  const nodeMap = useMemo(() => {
    const map = new Map<number, CellNode>();
    nodes.forEach(n => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  // Identify distinct lineage roots and assign layout coordinates
  const { nodeCoordinates, divisionEvents } = useMemo(() => {
    const coords = new Map<number, { x: number; y: number }>();
    const divisions = new Set<number>(); // target node ids that are divisions

    // Count divisions and group lineages
    const parentToChildren = new Map<number, number[]>();
    edges.forEach(e => {
      const existing = parentToChildren.get(e.source_id) || [];
      existing.push(e.target_id);
      parentToChildren.set(e.source_id, existing);
      if (e.is_division_edge || existing.length > 1) {
        divisions.add(e.target_id);
      }
    });

    // Group nodes by initial frame (t=0) or root lineages
    const rootNodes = nodes.filter(n => n.t === 0);
    const rootSpacing = innerWidth / Math.max(1, rootNodes.length + 1);

    // Compute track offsets
    rootNodes.forEach((rn, idx) => {
      const rootX = padding.left + (idx + 1) * rootSpacing;
      coords.set(rn.node_id, {
        x: rootX,
        y: padding.top + (rn.t / Math.max(1, maxTime)) * innerHeight,
      });

      // Breadth-first propagate layout positions
      const queue: { id: number; x: number; depth: number }[] = [{ id: rn.node_id, x: rootX, depth: 0 }];
      while (queue.length > 0) {
        const item = queue.shift()!;
        const children = parentToChildren.get(item.id) || [];
        if (children.length === 1) {
          const childId = children[0];
          const childNode = nodeMap.get(childId);
          if (childNode) {
            const y = padding.top + (childNode.t / Math.max(1, maxTime)) * innerHeight;
            coords.set(childId, { x: item.x, y });
            queue.push({ id: childId, x: item.x, depth: item.depth });
          }
        } else if (children.length >= 2) {
          // Division branch spread
          const spreadWidth = Math.max(24, 48 / (item.depth + 1));
          children.forEach((childId, cIdx) => {
            const childNode = nodeMap.get(childId);
            if (childNode) {
              const offsetX = cIdx === 0 ? -spreadWidth : spreadWidth;
              const x = Math.min(svgWidth - padding.right, Math.max(padding.left, item.x + offsetX));
              const y = padding.top + (childNode.t / Math.max(1, maxTime)) * innerHeight;
              coords.set(childId, { x, y });
              divisions.add(childId);
              queue.push({ id: childId, x, depth: item.depth + 1 });
            }
          });
        }
      }
    });

    // Fallback for unlinked nodes
    nodes.forEach(n => {
      if (!coords.has(n.node_id)) {
        const y = padding.top + (n.t / Math.max(1, maxTime)) * innerHeight;
        const x = padding.left + (n.node_id % 12) * (innerWidth / 12);
        coords.set(n.node_id, { x, y });
      }
    });

    return { nodeCoordinates: coords, divisionEvents: divisions };
  }, [nodes, edges, maxTime, innerHeight, innerWidth, nodeMap]);

  // Combined highlight set for Fate Mapping
  const fateSet = useMemo(() => {
    const s = new Set<number>();
    ancestorNodeIds.forEach(id => s.add(id));
    progenyNodeIds.forEach(id => s.add(id));
    if (selectedNodeId !== null) s.add(selectedNodeId);
    return s;
  }, [ancestorNodeIds, progenyNodeIds, selectedNodeId]);

  // Generate discrete time y-positions
  const timeAxisTicks = useMemo(() => {
    const ticks: { t: number; y: number }[] = [];
    for (let t = 0; t <= maxTime; t++) {
      ticks.push({
        t,
        y: padding.top + (t / Math.max(1, maxTime)) * innerHeight,
      });
    }
    return ticks;
  }, [maxTime, innerHeight]);

  const playheadY = padding.top + (currentTime / Math.max(1, maxTime)) * innerHeight;

  return (
    <div id="lineage-dendrogram-card" className="bg-[#181528] rounded-xl border border-[#352C58] p-4 flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#352C58]">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-[#6A45FF]" />
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              Lineage Dendrogram
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#6A45FF]/20 text-[#A259FF]">
                inTRACKtive
              </span>
            </h3>
            <p className="text-[11px] text-[#A5A1B8]">
              Developmental tree view (Time vs. lateral clonal branch space)
            </p>
          </div>
        </div>

        {selectedNodeId !== null && (
          <button
            id="clear-fate-selection"
            onClick={() => onSelectNodeId(null)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#00FFA3]/10 text-[#00FFA3] border border-[#00FFA3]/30 text-xs hover:bg-[#00FFA3]/20 transition"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Clear Fate (#{selectedNodeId})
          </button>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative flex-1 min-h-[360px] bg-[#0D0A1A] rounded-lg border border-[#251F3D] overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full select-none"
        >
          {/* Time axis horizontal grid lines */}
          {timeAxisTicks.map(tick => (
            <g key={`tick-${tick.t}`}>
              <line
                x1={padding.left - 8}
                y1={tick.y}
                x2={svgWidth - padding.right}
                y2={tick.y}
                stroke="#2A2244"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 16}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[10px] font-mono fill-[#A5A1B8]"
              >
                t = {tick.t}
              </text>
            </g>
          ))}

          {/* Active Playhead indicator line */}
          <line
            x1={padding.left - 8}
            y1={playheadY}
            x2={svgWidth - padding.right}
            y2={playheadY}
            stroke="#00FFA3"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            opacity={0.85}
          />
          <text
            x={svgWidth - padding.right}
            y={playheadY - 5}
            textAnchor="end"
            className="text-[9px] font-mono font-bold fill-[#00FFA3]"
          >
            PLAYHEAD (t={currentTime})
          </text>

          {/* Lineage Edges */}
          {edges.map(edge => {
            const p1 = nodeCoordinates.get(edge.source_id);
            const p2 = nodeCoordinates.get(edge.target_id);
            if (!p1 || !p2) return null;

            const isHighlighted =
              selectedNodeId !== null &&
              fateSet.has(edge.source_id) &&
              fateSet.has(edge.target_id);

            const isDivision = edge.is_division_edge || divisionEvents.has(edge.target_id);

            let strokeColor = '#483B70';
            let strokeWidth = 1.5;
            let opacity = 0.55;

            if (isHighlighted) {
              strokeColor = '#00FFA3';
              strokeWidth = 3.5;
              opacity = 1.0;
            } else if (isDivision) {
              strokeColor = '#FF4B4B';
              strokeWidth = 2.5;
              opacity = 0.9;
            }

            // Smooth cubic bezier spline from parent to daughter
            const midY = (p1.y + p2.y) / 2;
            const pathD = `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;

            return (
              <path
                key={`edge-${edge.id}`}
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            );
          })}

          {/* Tree Nodes */}
          {nodes.map(node => {
            const pos = nodeCoordinates.get(node.node_id);
            if (!pos) return null;

            const isSelected = selectedNodeId === node.node_id;
            const isAncestor = ancestorNodeIds.has(node.node_id);
            const isProgeny = progenyNodeIds.has(node.node_id);
            const isFate = isAncestor || isProgeny;
            const isDivision = divisionEvents.has(node.node_id);
            const isCurrent = node.t === currentTime;

            let fillColor = '#6A45FF';
            let radius = isCurrent ? 5.5 : 4;
            let strokeColor = '#FFFFFF';
            let strokeWidth = 0.8;

            if (isSelected) {
              fillColor = '#00FFA3';
              radius = 8;
              strokeColor = '#FFFFFF';
              strokeWidth = 2;
            } else if (isFate) {
              fillColor = '#00FFA3';
              radius = 6;
              strokeColor = '#181528';
              strokeWidth = 1.5;
            } else if (isDivision) {
              fillColor = '#FF4B4B';
              radius = 5.5;
            } else if (!isCurrent) {
              fillColor = '#3E3560';
            }

            return (
              <g
                key={`node-${node.node_id}`}
                id={`dendrogram-node-${node.node_id}`}
                onClick={() => {
                  onSelectNodeId(isSelected ? null : node.node_id);
                  onTimeChange(node.t);
                }}
                className="cursor-pointer group"
              >
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius + 4}
                    fill="none"
                    stroke="#00FFA3"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    className="animate-spin"
                  />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  className="transition-all duration-150 hover:scale-125"
                />

                {/* Node labels for highlighted or active nodes */}
                {(isCurrent || isSelected || isFate || isDivision) && (
                  <text
                    x={pos.x + (isDivision ? 7 : 6)}
                    y={pos.y + 3}
                    className={`text-[9px] font-mono select-none pointer-events-none ${
                      isSelected
                        ? 'fill-[#00FFA3] font-bold'
                        : isFate
                        ? 'fill-[#00FFA3]'
                        : isDivision
                        ? 'fill-[#FF4B4B] font-bold'
                        : 'fill-[#E2E8F0]'
                    }`}
                  >
                    #{node.node_id} {isDivision ? '⚡' : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center justify-between pt-3 mt-2 border-t border-[#352C58] text-[11px] text-[#A5A1B8]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FFA3] inline-block"></span>
            <span>Fate Target / Lineage</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4B4B] inline-block"></span>
            <span>Mitosis Fork (⚡)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6A45FF] inline-block"></span>
            <span>Active Cell (t={currentTime})</span>
          </div>
        </div>
        <div className="font-mono text-[10px] text-[#A5A1B8]">
          Click any node to trace fate backwards (ancestry) &amp; forward (progeny)
        </div>
      </div>
    </div>
  );
};
