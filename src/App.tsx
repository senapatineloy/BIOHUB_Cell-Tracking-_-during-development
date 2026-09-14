import React, { useState, useMemo } from 'react';
import { generateBenchmarkDataset } from './data/mockDataset';
import { evaluateTrackingSubmission } from './utils/metricCalculator';
import { Visualizer3D } from './components/Visualizer3D';
import { LineageDendrogram } from './components/LineageDendrogram';
import { MetricWorkbench } from './components/MetricWorkbench';
import { PythonPipelineModules } from './components/PythonPipelineModules';
import { SubmissionInspector } from './components/SubmissionInspector';
import { EngineeringPrinciples } from './components/EngineeringPrinciples';
import { GrandmasterEvolution } from './components/GrandmasterEvolution';
import { PHYSICAL_SCALING, CellEdge, BIOHUB_BRAND } from './types';
import { Box, FileCheck, ShieldCheck, Cpu, Layers, Crosshair, Terminal, Trophy } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<'visualizer' | 'metric' | 'evolution' | 'code' | 'submission' | 'principles'>('visualizer');
  const [currentTime, setCurrentTime] = useState<number>(2);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [visLayout, setVisLayout] = useState<'split' | '3d' | 'dendrogram'>('split');
  const [distanceThreshold, setDistanceThreshold] = useState<number>(PHYSICAL_SCALING.MAX_MATCHING_DISTANCE_UM);
  const [sparseMaskingRatio, setSparseMaskingRatio] = useState<number>(1.0);
  const [injectedFpEdges, setInjectedFpEdges] = useState<number>(0);
  const [estimatedNodes, setEstimatedNodes] = useState<number>(32);

  // Generate benchmark dataset
  const { gtNodes, gtEdges, predNodes, predEdges: basePredEdges } = useMemo(() => {
    return generateBenchmarkDataset();
  }, []);

  // Compute perturbed prediction edges when simulating spurious FP edges
  const predEdges = useMemo(() => {
    if (injectedFpEdges === 0) return basePredEdges;

    const modifiedEdges: CellEdge[] = [...basePredEdges];
    // Inject spurious edges between distant or unrelated nodes
    for (let i = 0; i < injectedFpEdges; i++) {
      const srcNode = predNodes[i % predNodes.length];
      const tgtCandidates = predNodes.filter(n => n.t === srcNode.t + 1 && n.node_id !== srcNode.node_id);
      if (tgtCandidates.length > 0) {
        const tgtNode = tgtCandidates[(i * 3 + 1) % tgtCandidates.length];
        modifiedEdges.push({
          id: 99000 + i,
          dataset: 'blastomere_dev_01',
          row_type: 'edge',
          node_id: -1,
          t: -1,
          z: -1,
          y: -1,
          x: -1,
          source_id: srcNode.node_id,
          target_id: tgtNode.node_id,
          physical_distance_um: 6.8,
        });
      }
    }
    return modifiedEdges;
  }, [basePredEdges, injectedFpEdges, predNodes]);

  // Compute live official evaluation metrics
  const metrics = useMemo(() => {
    return evaluateTrackingSubmission(
      gtNodes,
      gtEdges,
      predNodes,
      predEdges,
      distanceThreshold,
      sparseMaskingRatio,
      estimatedNodes
    );
  }, [gtNodes, gtEdges, predNodes, predEdges, distanceThreshold, sparseMaskingRatio, estimatedNodes]);

  const matchedGtIds = useMemo(() => {
    return new Set(metrics.matchedPairs.map(p => p.gtNodeId));
  }, [metrics]);

  const matchedPredIds = useMemo(() => {
    return new Set(metrics.matchedPairs.map(p => p.predNodeId));
  }, [metrics]);

  const maxTime = useMemo(() => {
    return Math.max(...gtNodes.map(n => n.t));
  }, [gtNodes]);

  // Compute bidirectional fate mapping (ancestral chain and progeny tree)
  const { ancestorNodeIds, progenyNodeIds } = useMemo(() => {
    if (selectedNodeId === null) {
      return { ancestorNodeIds: new Set<number>(), progenyNodeIds: new Set<number>() };
    }

    const parentMap = new Map<number, number>();
    const childrenMap = new Map<number, number[]>();

    for (const e of predEdges) {
      parentMap.set(e.target_id, e.source_id);
      const list = childrenMap.get(e.source_id) || [];
      list.push(e.target_id);
      childrenMap.set(e.source_id, list);
    }

    // Trace ancestors backwards
    const ancestors = new Set<number>();
    let curr: number | undefined = selectedNodeId;
    while (curr !== undefined && parentMap.has(curr)) {
      curr = parentMap.get(curr)!;
      ancestors.add(curr);
    }

    // Trace progeny forwards
    const progeny = new Set<number>();
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      const children = childrenMap.get(parent) || [];
      for (const child of children) {
        if (!progeny.has(child)) {
          progeny.add(child);
          queue.push(child);
        }
      }
    }

    return { ancestorNodeIds: ancestors, progenyNodeIds: progeny };
  }, [selectedNodeId, predEdges]);

  return (
    <div className="min-h-screen bg-[#120E20] text-[#F0EDFF] flex flex-col antialiased selection:bg-[#6A45FF]/40 selection:text-[#F0EDFF]">
      {/* Top Header with bi[o]hub official circular emblem */}
      <header className="border-b border-[#352C58] bg-[#181528]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* High-Visibility Circular Emblem */}
            <div
              style={{
                width: '48px',
                height: '48px',
                minWidth: '48px',
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '2.5px solid #6A45FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(106, 69, 255, 0.45)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                  fontSize: '11px',
                  fontWeight: 900,
                  color: '#0A0714',
                  letterSpacing: '-0.3px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                bi<span style={{ color: '#6A45FF', fontWeight: 900, fontSize: '12px', margin: '0 1px' }}>[</span>o<span style={{ color: '#6A45FF', fontWeight: 900, fontSize: '12px', margin: '0 1px' }}>]</span>hub
              </span>
            </div>

            {/* Header Title & Clean Subtitle */}
            <div>
              <div
                style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.3px',
                }}
              >
                Cell Tracking During Development
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#8E88B0',
                  marginTop: '1px',
                }}
              >
                Developmental Cell Dynamics Core
              </div>
            </div>
          </div>

          {/* Top-Right Telemetry Badge */}
          <div className="font-mono text-xs text-[#00FFA3] bg-[#0A0714] px-3.5 py-1.5 rounded-full border border-[#251D4A] flex items-center gap-2 shadow-sm">
            <span className="text-[#00FFA3]">●</span>
            <span className="text-[#F0EDFF]">Scale: 1.625 / 0.406 µm | Engine: Ultrack LAP</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-1 border-t border-[#352C58] pt-1 scrollbar-none text-xs font-medium">
          <button
            onClick={() => setActiveView('visualizer')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeView === 'visualizer'
                ? 'border-[#6A45FF] text-white font-bold bg-[#6A45FF]/10'
                : 'border-transparent text-[#A5A1B8] hover:text-white hover:border-[#352C58]'
            }`}
          >
            <Box className="w-4 h-4 text-[#A259FF]" />
            🔬 Lineage Studio
          </button>

          <button
            onClick={() => setActiveView('metric')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeView === 'metric'
                ? 'border-[#6A45FF] text-white font-bold bg-[#6A45FF]/10'
                : 'border-transparent text-[#A5A1B8] hover:text-white hover:border-[#352C58]'
            }`}
          >
            <Cpu className="w-4 h-4 text-[#A259FF]" />
            ⚡ Ingestion &amp; Tracking Engine
          </button>

          <button
            onClick={() => setActiveView('evolution')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeView === 'evolution'
                ? 'border-[#6A45FF] text-white font-bold bg-[#6A45FF]/10'
                : 'border-transparent text-[#A5A1B8] hover:text-white hover:border-[#352C58]'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            🏆 Grandmaster Evolution (v30 Suite)
          </button>

          <button
            onClick={() => setActiveView('submission')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeView === 'submission'
                ? 'border-[#6A45FF] text-white font-bold bg-[#6A45FF]/10'
                : 'border-transparent text-[#A5A1B8] hover:text-white hover:border-[#352C58]'
            }`}
          >
            <FileCheck className="w-4 h-4 text-[#A259FF]" />
            📋 Verification Audit &amp; Precision Export
          </button>

          <button
            onClick={() => setActiveView('code')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeView === 'code'
                ? 'border-[#6A45FF] text-white font-bold bg-[#6A45FF]/10'
                : 'border-transparent text-[#A5A1B8] hover:text-white hover:border-[#352C58]'
            }`}
          >
            <Terminal className="w-4 h-4 text-[#A259FF]" />
            💻 Production Python Pipelines
          </button>

          <button
            onClick={() => setActiveView('principles')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeView === 'principles'
                ? 'border-[#6A45FF] text-white font-bold bg-[#6A45FF]/10'
                : 'border-transparent text-[#A5A1B8] hover:text-white hover:border-[#352C58]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#A259FF]" />
            🧪 Test Suite &amp; Invariants
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* View Routing */}
        {activeView === 'visualizer' && (
          <div className="space-y-6">
            {/* Visualizer Layout & Fate Mapping Control Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-[#181528] border border-[#352C58] text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#A5A1B8] font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#A259FF]" /> Viewport Layout:
                </span>
                <div className="flex items-center bg-[#120E20] rounded-lg p-0.5 border border-[#352C58]">
                  <button
                    onClick={() => setVisLayout('split')}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      visLayout === 'split'
                        ? 'bg-[#6A45FF] text-white shadow-sm'
                        : 'text-[#A5A1B8] hover:text-white'
                    }`}
                  >
                    Dual Split (3D + Lineage)
                  </button>
                  <button
                    onClick={() => setVisLayout('3d')}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      visLayout === '3d'
                        ? 'bg-[#6A45FF] text-white shadow-sm'
                        : 'text-[#A5A1B8] hover:text-white'
                    }`}
                  >
                    3D Spatial Only
                  </button>
                  <button
                    onClick={() => setVisLayout('dendrogram')}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      visLayout === 'dendrogram'
                        ? 'bg-[#6A45FF] text-white shadow-sm'
                        : 'text-[#A5A1B8] hover:text-white'
                    }`}
                  >
                    Lineage Dendrogram Only
                  </button>
                </div>
              </div>

              {/* Fate Mapping Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[#A5A1B8] font-medium flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-[#00FFA3]" /> Fate Map Target:
                </span>
                <select
                  value={selectedNodeId !== null ? selectedNodeId : ''}
                  onChange={e => setSelectedNodeId(e.target.value === '' ? null : Number(e.target.value))}
                  className="bg-[#120E20] border border-[#352C58] text-[#F0EDFF] px-2.5 py-1 rounded text-xs focus:outline-none focus:border-[#6A45FF]"
                >
                  <option value="">None (Inspect All Cells)</option>
                  {predNodes.map(n => (
                    <option key={n.node_id} value={n.node_id}>
                      Node #{n.node_id} [t={n.t}, Track {n.track_id}{n.is_division_mother ? ' - Mitosis Mother' : ''}]
                    </option>
                  ))}
                </select>

                {selectedNodeId !== null && (
                  <div className="flex items-center gap-2 bg-[#00FFA3]/10 border border-[#00FFA3]/40 px-2.5 py-1 rounded text-[11px] font-mono text-[#00FFA3]">
                    <span>Ancestors: {ancestorNodeIds.size}</span>
                    <span>&bull;</span>
                    <span>Progeny: {progenyNodeIds.size}</span>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="ml-1 text-[#A5A1B8] hover:text-white font-sans px-1"
                      title="Clear Fate Selection"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Viewport Renderers */}
            <div className={`grid gap-6 ${visLayout === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
              {(visLayout === 'split' || visLayout === '3d') && (
                <div className="h-[560px]">
                  <Visualizer3D
                    gtNodes={gtNodes}
                    gtEdges={gtEdges}
                    predNodes={predNodes}
                    predEdges={predEdges}
                    currentTime={currentTime}
                    onTimeChange={setCurrentTime}
                    maxTime={maxTime}
                    matchedGtIds={matchedGtIds}
                    matchedPredIds={matchedPredIds}
                    selectedNodeId={selectedNodeId}
                    onSelectNodeId={setSelectedNodeId}
                    ancestorNodeIds={ancestorNodeIds}
                    progenyNodeIds={progenyNodeIds}
                  />
                </div>
              )}

              {(visLayout === 'split' || visLayout === 'dendrogram') && (
                <div className="h-[560px]">
                  <LineageDendrogram
                    nodes={predNodes}
                    edges={predEdges}
                    currentTime={currentTime}
                    onTimeChange={setCurrentTime}
                    selectedNodeId={selectedNodeId}
                    onSelectNodeId={setSelectedNodeId}
                    ancestorNodeIds={ancestorNodeIds}
                    progenyNodeIds={progenyNodeIds}
                    maxTime={maxTime}
                  />
                </div>
              )}
            </div>

            {/* Quick Metric Summary Under Visualizer */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3.5 rounded-xl bg-[#181528] border border-[#352C58]">
                <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-medium">Active Cells [t={currentTime}]</div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {predNodes.filter(n => n.t === currentTime).length}
                </div>
                <div className="text-[10px] text-[#A5A1B8] mt-0.5">Timeframe {currentTime} / {maxTime}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#181528] border border-[#352C58]">
                <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-medium">Trajectory Edges</div>
                <div className="text-xl font-bold font-mono text-white mt-1">{predEdges.length}</div>
                <div className="text-[10px] text-[#A5A1B8] mt-0.5">LAP Bipartite Matched</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#181528] border border-[#352C58]">
                <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-medium">Mitotic Splits (⚡)</div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                  {predEdges.filter(e => e.is_division_edge).length / 2 || metrics.divisionMetrics.tpDivisions} Events
                </div>
                <div className="text-[10px] text-amber-500/80 mt-0.5">Both daughter links verified</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#181528] border border-[#352C58]">
                <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-medium">True Positive Edges</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{metrics.edgeMetrics.tpEdges} / {gtEdges.length}</div>
                <div className="text-[10px] text-emerald-500/80 mt-0.5">Matched within 7.0 µm</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#181528] border border-[#352C58]">
                <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-medium">Node Ratio (N / Nest)</div>
                <div className="text-xl font-bold font-mono text-[#00FFA3] mt-1">
                  {(predNodes.length / estimatedNodes).toFixed(2)}
                </div>
                <div className="text-[10px] text-[#00FFA3]/80 mt-0.5">No over-prediction penalty</div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'metric' && (
          <MetricWorkbench
            metrics={metrics}
            distanceThreshold={distanceThreshold}
            onDistanceThresholdChange={setDistanceThreshold}
            sparseMaskingRatio={sparseMaskingRatio}
            onSparseMaskingRatioChange={setSparseMaskingRatio}
            injectedFpEdges={injectedFpEdges}
            onInjectedFpEdgesChange={setInjectedFpEdges}
            estimatedNodes={estimatedNodes}
            onEstimatedNodesChange={setEstimatedNodes}
          />
        )}

        {activeView === 'evolution' && (
          <GrandmasterEvolution />
        )}

        {activeView === 'code' && (
          <PythonPipelineModules />
        )}

        {activeView === 'submission' && (
          <SubmissionInspector nodes={predNodes} edges={predEdges} />
        )}

        {activeView === 'principles' && (
          <EngineeringPrinciples />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#352C58] bg-[#141122] py-4 text-center text-xs text-[#A5A1B8] font-mono">
        bi<span className="text-[#6A45FF]">[</span>o<span className="text-[#6A45FF]">]</span>hub Cell Tracking During Development &bull; Anisotropic Euclidean Gating (7.0 µm) &bull; Kaggle Offline Inference Certified
      </footer>
    </div>
  );
}
