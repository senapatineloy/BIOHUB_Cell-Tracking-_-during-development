import React, { useState, useMemo } from 'react';
import { generateBenchmarkDataset } from './data/mockDataset';
import { evaluateTrackingSubmission } from './utils/metricCalculator';
import { Visualizer3D } from './components/Visualizer3D';
import { LineageDendrogram } from './components/LineageDendrogram';
import { MetricWorkbench } from './components/MetricWorkbench';
import { PythonPipelineModules } from './components/PythonPipelineModules';
import { SubmissionInspector } from './components/SubmissionInspector';
import { EngineeringPrinciples } from './components/EngineeringPrinciples';
import { PHYSICAL_SCALING, CellEdge, BIOHUB_BRAND } from './types';
import { Activity, Box, Terminal, FileCheck, ShieldCheck, Cpu, Layers, Copy, Check, Sparkles, GitBranch, Crosshair } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<'visualizer' | 'metric' | 'code' | 'submission' | 'principles'>('visualizer');
  const [currentTime, setCurrentTime] = useState<number>(2);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [visLayout, setVisLayout] = useState<'split' | '3d' | 'dendrogram'>('split');
  const [distanceThreshold, setDistanceThreshold] = useState<number>(PHYSICAL_SCALING.MAX_MATCHING_DISTANCE_UM);
  const [sparseMaskingRatio, setSparseMaskingRatio] = useState<number>(1.0);
  const [injectedFpEdges, setInjectedFpEdges] = useState<number>(0);
  const [estimatedNodes, setEstimatedNodes] = useState<number>(32);
  const [copiedBanner, setCopiedBanner] = useState<boolean>(false);

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

  const copyKaggleMarkdownBanner = () => {
    const banner = `<div style="background: linear-gradient(135deg, #181528 0%, #2A1D54 100%); padding: 24px 28px; border-radius: 12px; border-left: 6px solid #6A45FF; margin-bottom: 20px;">
    <span style="font-family: -apple-system, sans-serif; font-size: 28px; font-weight: 800; color: #FFFFFF;">
        bi<span style="color: #6A45FF;">[</span>o<span style="color: #6A45FF;">]</span>hub
    </span>
    <span style="font-size: 15px; color: #A5A1B8; font-weight: 600; margin-left: 10px; text-transform: uppercase;">
        | Cell Tracking During Development
    </span>
</div>`;
    navigator.clipboard.writeText(banner);
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#120E20] text-[#F0EDFF] flex flex-col antialiased selection:bg-[#6A45FF]/40 selection:text-[#F0EDFF]">
      {/* Top Competition Mission Control Header with bi[o]hub wordmark */}
      <header className="border-b border-[#352C58] bg-[#181528]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#6A45FF] text-white shadow-lg shadow-[#6A45FF]/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-sans">
                  bi<span className="text-[#6A45FF]">[</span>o<span className="text-[#6A45FF]">]</span>hub
                </span>
                <span className="text-sm font-semibold uppercase tracking-wider text-[#A5A1B8] hidden sm:inline">
                  | Cell Tracking During Development
                </span>
                <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#6A45FF]/20 text-[#A259FF] border border-[#6A45FF]/40">
                  Grandmaster Workbench
                </span>
              </div>
              <p className="text-xs text-[#A5A1B8] mt-0.5">
                4D Zarr v3 Volumes &bull; Metric: <span className="font-mono text-emerald-400 font-medium">AdjEdgeJaccard + 0.1&times;DivJaccard</span> &bull; Cutoff: <span className="font-mono text-[#A259FF]">7.0 µm</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#201A36] border border-[#6A45FF]/50 shadow-sm">
              <span className="text-[11px] text-[#A5A1B8]">Score:</span>
              <span className="text-white font-bold text-sm">{metrics.combinedScore.toFixed(4)}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#201A36] border border-[#352C58]">
              <span className="text-[11px] text-[#A5A1B8]">Adj Edge Jaccard:</span>
              <span className="text-emerald-400 font-semibold">{metrics.edgeMetrics.adjustedEdgeJaccard.toFixed(4)}</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#201A36] border border-[#352C58]">
              <span className="text-[11px] text-[#A5A1B8]">Div Jaccard:</span>
              <span className="text-amber-400 font-semibold">{metrics.divisionMetrics.divisionJaccard.toFixed(4)}</span>
            </div>
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
            3D+t Lineage Reconstruction
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
            Metric &amp; Over-Prediction Console
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
            12h Offline Python Pipelines
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
            Submission Invariant Validator
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
            Grandmaster Invariants &amp; 12h Budget
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Physical Scaling & Banner Copy Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#181528] border border-[#352C58] text-xs text-[#F0EDFF]">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[#A5A1B8] flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-[#A259FF]" /> Domain Coordinates:
            </span>
            <span className="font-mono text-white">z = 1.625 µm/vox</span>
            <span className="font-mono text-[#A259FF]">y, x = 0.40625 µm/vox</span>
            <span className="text-amber-400 font-mono font-medium">(4.0&times; z-anisotropy)</span>
            <span className="text-emerald-400 font-mono font-medium">Matching Cutoff: &le; 7.0 µm</span>
          </div>

          <button
            onClick={copyKaggleMarkdownBanner}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#251E3D] hover:bg-[#322954] text-[#F0EDFF] text-xs font-mono transition-colors border border-[#483B75]"
            title="Copy mandatory bi[o]hub Kaggle Notebook Markdown Banner"
          >
            {copiedBanner ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#A259FF]" />}
            <span>{copiedBanner ? 'Copied Kaggle Banner' : 'Copy Kaggle Markdown Banner'}</span>
          </button>
        </div>

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
        bi<span className="text-[#6A45FF]">[</span>o<span className="text-[#6A45FF]">]</span>hub Cell Tracking During Development &bull; Anisotropic Euclidean Gating (7.0 µm) &bull; 12h Offline Inference Certified
      </footer>
    </div>
  );
}
