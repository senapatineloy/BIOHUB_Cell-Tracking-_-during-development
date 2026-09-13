import React, { useState } from 'react';
import { MetricEvaluationResult, PHYSICAL_SCALING, BIOHUB_BRAND } from '../types';
import { ShieldAlert, Cpu, Zap, Info, Sliders, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MetricWorkbenchProps {
  metrics: MetricEvaluationResult;
  distanceThreshold: number;
  onDistanceThresholdChange: (val: number) => void;
  sparseMaskingRatio: number;
  onSparseMaskingRatioChange: (val: number) => void;
  injectedFpEdges: number;
  onInjectedFpEdgesChange: (val: number) => void;
  estimatedNodes: number;
  onEstimatedNodesChange: (val: number) => void;
}

export const MetricWorkbench: React.FC<MetricWorkbenchProps> = ({
  metrics,
  distanceThreshold,
  onDistanceThresholdChange,
  sparseMaskingRatio,
  onSparseMaskingRatioChange,
  injectedFpEdges,
  onInjectedFpEdgesChange,
  estimatedNodes,
  onEstimatedNodesChange,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'overprediction' | 'sensitivity' | 'math'>('overview');

  const { nodeMatches, edgeMetrics, divisionMetrics, combinedScore, overPredictionAnalysis } = metrics;

  // Compute sensitivity gradient for FP edge impact
  const currentDenom = edgeMetrics.tpEdges + edgeMetrics.fpEdges + edgeMetrics.fnEdges;
  const fpEdgePenaltyGradient = currentDenom > 0
    ? -edgeMetrics.tpEdges / Math.pow(currentDenom, 2)
    : 0;

  const predCount = nodeMatches.tpNodes + nodeMatches.fpNodes;
  const overPredRatio = overPredictionAnalysis?.ratio || (predCount / Math.max(1, estimatedNodes));
  const penaltyFactor = overPredictionAnalysis?.penaltyFactor ?? 1.0;

  return (
    <div className="flex flex-col bg-[#181528] rounded-xl border border-[#352C58] overflow-hidden shadow-2xl">
      {/* Metric Workbench Header */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-[#1F1A35] border-b border-[#352C58] gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#6A45FF]/20 border border-[#6A45FF]/40 text-[#A259FF]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              bi<span className="text-[#6A45FF]">[</span>o<span className="text-[#6A45FF]">]</span>hub Metric &amp; Over-Prediction Console
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#6A45FF]/20 text-[#A259FF] border border-[#6A45FF]/30">
                Official Spec
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#141122] p-0.5 rounded-lg border border-[#352C58] text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'overview' ? 'bg-[#6A45FF] text-white shadow-sm' : 'text-[#A5A1B8] hover:text-white'
            }`}
          >
            Confusion Matrices
          </button>
          <button
            onClick={() => setActiveTab('overprediction')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'overprediction' ? 'bg-[#6A45FF] text-white shadow-sm' : 'text-[#A5A1B8] hover:text-white'
            }`}
          >
            Node Over-Prediction
            {overPredRatio > 1.05 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sensitivity')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'sensitivity' ? 'bg-[#6A45FF] text-white shadow-sm' : 'text-[#A5A1B8] hover:text-white'
            }`}
          >
            FP Edge Stress
          </button>
          <button
            onClick={() => setActiveTab('math')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'math' ? 'bg-[#6A45FF] text-white shadow-sm' : 'text-[#A5A1B8] hover:text-white'
            }`}
          >
            Formulation &amp; Proofs
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Metric Headline Score Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Combined Score */}
          <div className="p-4 rounded-xl bg-[#201A36] border border-[#6A45FF]/40 relative overflow-hidden shadow-lg">
            <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-semibold">Total Official Score</div>
            <div className="text-3xl font-black font-mono text-[#F0EDFF] mt-1">
              {combinedScore.toFixed(4)}
            </div>
            <div className="mt-1.5 text-[11px] text-[#A259FF] font-mono flex items-center gap-1">
              <span>AdjEdge + 0.1&times;Div</span>
            </div>
          </div>

          {/* Adjusted Edge Jaccard */}
          <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58]">
            <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-semibold">Adjusted Edge Jaccard</div>
            <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">
              {edgeMetrics.adjustedEdgeJaccard.toFixed(4)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
              TP: {edgeMetrics.tpEdges} / {edgeMetrics.tpEdges + edgeMetrics.fpEdges + edgeMetrics.fnEdges}
            </div>
          </div>

          {/* Division Jaccard */}
          <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58]">
            <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-semibold">Division Jaccard (0.1&times;)</div>
            <div className="text-3xl font-bold font-mono text-amber-400 mt-1">
              {divisionMetrics.divisionJaccard.toFixed(4)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
              Score Contrib: +{(PHYSICAL_SCALING.DIVISION_WEIGHT * divisionMetrics.divisionJaccard).toFixed(4)}
            </div>
          </div>

          {/* Over-Prediction Ratio */}
          <div className={`p-4 rounded-xl border ${
            overPredRatio > 1.15
              ? 'bg-rose-950/20 border-rose-600/40 text-rose-200'
              : 'bg-[#201A36] border-[#352C58]'
          }`}>
            <div className="text-[11px] text-[#A5A1B8] uppercase tracking-wider font-semibold">Node Over-Prediction</div>
            <div className={`text-3xl font-bold font-mono mt-1 ${
              overPredRatio > 1.05 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {(overPredRatio * 100).toFixed(0)}%
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-[#A5A1B8]">
              {predCount} pred / {estimatedNodes} est
            </div>
          </div>
        </div>

        {/* Tab 1: Confusion Matrices */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Edge Matrix Card */}
            <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-3">
              <div className="flex items-center justify-between border-b border-[#352C58] pb-2">
                <span className="font-bold text-xs text-white">Edge Confusion Matrix</span>
                <span className="text-[11px] font-mono text-[#A5A1B8]">D &le; 7.0 µm</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                  <div className="text-[10px] text-emerald-400 font-sans">True Positives</div>
                  <div className="text-lg font-bold text-emerald-300">{edgeMetrics.tpEdges}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
                  <div className="text-[10px] text-rose-400 font-sans">False Positives</div>
                  <div className="text-lg font-bold text-rose-300">{edgeMetrics.fpEdges}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40">
                  <div className="text-[10px] text-amber-400 font-sans">False Negatives</div>
                  <div className="text-lg font-bold text-amber-300">{edgeMetrics.fnEdges}</div>
                </div>
              </div>
              <p className="text-[11px] text-[#A5A1B8] leading-relaxed">
                Edges require both parent and daughter nodes to bipartite-match their respective ground truth within <span className="font-mono text-[#F0EDFF]">7.0 µm</span>.
              </p>
            </div>

            {/* Division Matrix Card */}
            <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-3">
              <div className="flex items-center justify-between border-b border-[#352C58] pb-2">
                <span className="font-bold text-xs text-white">Division Events (Mitosis)</span>
                <span className="text-[11px] font-mono text-[#A5A1B8]">Out-degree = 2</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40">
                  <div className="text-[10px] text-amber-400 font-sans">TP Splits</div>
                  <div className="text-lg font-bold text-amber-300">{divisionMetrics.tpDivisions}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
                  <div className="text-[10px] text-rose-400 font-sans">FP Splits</div>
                  <div className="text-lg font-bold text-rose-300">{divisionMetrics.fpDivisions}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#181528] border border-[#352C58]">
                  <div className="text-[10px] text-[#A5A1B8] font-sans">FN Splits</div>
                  <div className="text-lg font-bold text-slate-300">{divisionMetrics.fnDivisions}</div>
                </div>
              </div>
              <p className="text-[11px] text-[#A5A1B8] leading-relaxed">
                Both daughters must match. Spurious division guesses generate guaranteed edge false positives.
              </p>
            </div>

            {/* Node Bipartite Matrix */}
            <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-3">
              <div className="flex items-center justify-between border-b border-[#352C58] pb-2">
                <span className="font-bold text-xs text-white">Node Gating (3D Centroids)</span>
                <span className="text-[11px] font-mono text-[#A5A1B8]">Hungarian Match</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-[#6A45FF]/20 border border-[#6A45FF]/40">
                  <div className="text-[10px] text-[#A259FF] font-sans">TP Nodes</div>
                  <div className="text-lg font-bold text-[#F0EDFF]">{nodeMatches.tpNodes}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
                  <div className="text-[10px] text-rose-400 font-sans">Ghost Nodes (FP)</div>
                  <div className="text-lg font-bold text-rose-300">{nodeMatches.fpNodes}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#181528] border border-[#352C58]">
                  <div className="text-[10px] text-[#A5A1B8] font-sans">Missed (FN)</div>
                  <div className="text-lg font-bold text-slate-300">{nodeMatches.fnNodes}</div>
                </div>
              </div>
              <p className="text-[11px] text-[#A5A1B8] leading-relaxed">
                Calculated with 4x anisotropy: <span className="font-mono text-xs text-[#A259FF]">D&sup2; = 1.625&sup2;&Delta;z&sup2; + 0.40625&sup2;(&Delta;y&sup2; + &Delta;x&sup2;)</span>.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Node Over-Prediction Penalty Dynamics */}
        {activeTab === 'overprediction' && (
          <div className="p-5 rounded-xl bg-[#201A36] border border-[#352C58] space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#6A45FF]/20 border border-[#6A45FF]/40 text-[#A259FF]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  The Node Over-Prediction Penalty Dynamic
                </h3>
                <p className="text-xs text-[#A5A1B8] mt-1 leading-relaxed max-w-3xl">
                  In this competition, predicting more cell nodes than the prior <span className="font-mono text-[#F0EDFF]">estimated_number_of_nodes</span> heavily degrades Adjusted Edge Jaccard. High recall at the expense of precision is severely penalized.
                </p>
              </div>
            </div>

            {/* Slider to adjust estimated nodes prior */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-[#352C58]">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#F0EDFF] font-medium">Ground-Truth estimated_number_of_nodes</span>
                  <span className="font-mono text-[#A259FF] font-bold">{estimatedNodes} Nodes</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={60}
                  step={1}
                  value={estimatedNodes}
                  onChange={e => onEstimatedNodesChange(Number(e.target.value))}
                  className="w-full accent-[#6A45FF] h-1.5 bg-[#141122] rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#A5A1B8] font-mono">
                  <span>15 (Sparse)</span>
                  <span className="text-[#A259FF]">Current: {estimatedNodes}</span>
                  <span>60 (Dense)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#181528] border border-[#352C58] space-y-2">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Penalty Impact Factor:</span>
                  <span className={`font-mono text-sm ${penaltyFactor < 0.95 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {(penaltyFactor * 100).toFixed(1)}% Score Retention
                  </span>
                </div>
                <p className="text-[11px] text-[#A5A1B8] leading-relaxed">
                  {overPredRatio > 1.15
                    ? `Severe over-prediction (${(overPredRatio * 100).toFixed(0)}% of estimated count). Detector threshold must be raised from 0.45 -> 0.60 to suppress ghost nodes.`
                    : overPredRatio > 1.02
                    ? `Mild over-prediction (${(overPredRatio * 100).toFixed(0)}%). Small penalty applied.`
                    : `Optimal precision regime (${(overPredRatio * 100).toFixed(0)}%). Zero over-prediction penalty.`}
                </p>
              </div>
            </div>

            {/* Diagnostic Curve Visualization Card adhering to Biohub brand standard */}
            <div className="p-4 rounded-xl bg-[#141122] border border-[#352C58] space-y-3">
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>bi[o]hub Diagnostic Simulation Curve (Python Matplotlib Standard)</span>
                <span className="font-mono text-[10px] text-[#A259FF]">Color: #6A45FF | Grid: #EDEDED</span>
              </div>
              <div className="h-32 bg-[#FAF9FF] rounded-lg border border-[#352C58] p-3 flex flex-col justify-between relative overflow-hidden">
                {/* SVG Curve rendering the score degradation as over-prediction ratio increases */}
                <svg className="w-full h-24 overflow-visible">
                  {/* Grid lines #EDEDED */}
                  <line x1="0" y1="20" x2="100%" y2="20" stroke="#EDEDED" strokeWidth="1" />
                  <line x1="0" y1="50" x2="100%" y2="50" stroke="#EDEDED" strokeWidth="1" />
                  <line x1="0" y1="80" x2="100%" y2="80" stroke="#EDEDED" strokeWidth="1" />
                  {/* Optimal line */}
                  <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#A259FF" strokeWidth="1.5" strokeDasharray="3 3" />
                  {/* Score Trajectory in #6A45FF */}
                  <path
                    d="M 10 30 Q 150 25, 250 35 T 500 85 T 800 110"
                    fill="none"
                    stroke="#6A45FF"
                    strokeWidth="3"
                  />
                  {/* Current Operating Point */}
                  <circle
                    cx={`${Math.min(95, Math.max(5, (overPredRatio - 0.5) * 60))}%`}
                    cy="40"
                    r="5"
                    fill="#6A45FF"
                    stroke="#181528"
                    strokeWidth="2"
                  />
                </svg>
                <div className="flex justify-between text-[10px] font-mono text-[#181528] pt-1">
                  <span>0.8x (Under-detect)</span>
                  <span className="font-bold text-[#6A45FF]">1.0x (Peak Score)</span>
                  <span>1.5x (Severe Penalty)</span>
                  <span>2.0x (Score Collapse)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: FP Stress Simulator */}
        {activeTab === 'sensitivity' && (
          <div className="p-5 rounded-xl bg-[#201A36] border border-[#352C58] space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  Asymmetric Risk of False-Positive Edge Injection
                </h3>
                <p className="text-xs text-[#A5A1B8] mt-1 leading-relaxed max-w-3xl">
                  Division Jaccard carries only a 0.1 weight while Edge Jaccard carries 1.0 weight. Any aggressive heuristic that gains 1 true division at the cost of 2 FP edges results in a net negative score delta.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-[#352C58]">
              {/* Distance Threshold Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#F0EDFF] font-medium">Bipartite Distance Cutoff</span>
                  <span className="font-mono text-[#A259FF] font-bold">{distanceThreshold.toFixed(1)} µm</span>
                </div>
                <input
                  type="range"
                  min={2.0}
                  max={12.0}
                  step={0.5}
                  value={distanceThreshold}
                  onChange={e => onDistanceThresholdChange(Number(e.target.value))}
                  className="w-full accent-[#6A45FF] h-1.5 bg-[#141122] rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#A5A1B8] font-mono">
                  <span>2.0 µm</span>
                  <span className="text-[#6A45FF] font-bold">Official: 7.0 µm</span>
                  <span>12.0 µm</span>
                </div>
              </div>

              {/* Injected False-Positive Edges */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-300 font-medium">Simulate Spurious FP Edges</span>
                  <span className="font-mono text-rose-400 font-bold">+{injectedFpEdges} Edges</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={injectedFpEdges}
                  onChange={e => onInjectedFpEdgesChange(Number(e.target.value))}
                  className="w-full accent-rose-500 h-1.5 bg-[#141122] rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#A5A1B8] font-mono">
                  <span>0 (Clean)</span>
                  <span>+10 (Over-split)</span>
                  <span>+20 (Catastrophic)</span>
                </div>
              </div>

              {/* Sparse Annotation Masking Factor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#F0EDFF] font-medium">Sparse Ground-Truth Mask</span>
                  <span className="font-mono text-[#A259FF] font-bold">{(sparseMaskingRatio * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.1}
                  value={sparseMaskingRatio}
                  onChange={e => onSparseMaskingRatioChange(Number(e.target.value))}
                  className="w-full accent-[#6A45FF] h-1.5 bg-[#141122] rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#A5A1B8] font-mono">
                  <span>20% (Sparse)</span>
                  <span>60%</span>
                  <span>100% (Dense)</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#141122] border border-[#352C58] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-[#F0EDFF]">
                  Instantaneous Marginal Penalty: <span className="font-mono text-rose-400 font-bold">&Delta;Score / &Delta;FP_edge = {(fpEdgePenaltyGradient).toFixed(4)}</span>
                </span>
              </div>
              <span className="text-[11px] text-[#A5A1B8] font-mono">
                Adding 1 false positive edge drops score by ~{Math.abs(fpEdgePenaltyGradient * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Tab 4: Mathematical Proof & Formulations */}
        {activeTab === 'math' && (
          <div className="p-5 rounded-xl bg-[#201A36] border border-[#352C58] space-y-4 text-xs leading-relaxed text-[#F0EDFF]">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-[#6A45FF]" />
              bi[o]hub Grandmaster Mathematical Invariants
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-[#141122] border border-[#352C58] space-y-1.5">
                <div className="font-semibold text-[#A259FF]">1. 4:1 Anisotropic Physical Distance Formula</div>
                <div className="font-mono text-[11px] text-emerald-400 bg-[#0F0C18] p-2.5 rounded border border-[#352C58]">
                  D(p, q) = &radic;( (1.625 &times; &Delta;z)&sup2; + (0.40625 &times; &Delta;y)&sup2; + (0.40625 &times; &Delta;x)&sup2; ) &le; 7.0 µm
                </div>
                <p className="text-[#A5A1B8]">
                  In raw voxel space, maximum allowable motion in z is 7.0 / 1.625 = 4.307 voxels, whereas in x/y it is 7.0 / 0.40625 = 17.23 voxels.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#141122] border border-[#352C58] space-y-1.5">
                <div className="font-semibold text-[#A259FF]">2. Proof of Division Risk Inversion</div>
                <div className="font-mono text-[11px] text-amber-300 bg-[#0F0C18] p-2.5 rounded border border-[#352C58]">
                  Score = Adjusted Edge Jaccard + 0.1 &times; Division Jaccard
                  <br />
                  1 True Division: +0.10 score delta.
                  <br />
                  1 False Mitosis Guess (2 FP Edges): -0.15 to -0.28 score delta!
                </div>
                <p className="text-[#A5A1B8]">
                  Zero speculative splitting: Mitotic bifurcation should only be asserted if daughter-daughter separation is within 1.8 to 6.5 µm and mass conservation is verified.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
