import React from 'react';
import { Target, Layers, ShieldCheck, Cpu, AlertOctagon, Flame } from 'lucide-react';
import { PipelineLatencyChart } from './PipelineLatencyChart';
import { RigorousVerificationRunner } from './RigorousVerificationRunner';

export const EngineeringPrinciples: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 1. Rigorous Automated Invariant Test Runner Module */}
      <RigorousVerificationRunner />

      {/* 2. Real-Time Recharts Latency Profiler Across Dataset Scales */}
      <PipelineLatencyChart />

      {/* 3. Core Architectural Principles & Mitigation Cards */}
      <div className="flex flex-col bg-[#181528] rounded-xl border border-[#352C58] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[#1F1A35] border-b border-[#352C58]">
          <div className="p-1.5 rounded-lg bg-[#6A45FF]/20 border border-[#6A45FF]/40 text-[#A259FF]">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white flex items-center gap-2">
              bi<span className="text-[#6A45FF]">[</span>o<span className="text-[#6A45FF]">]</span>hub Engineering Strategy, Edge-Case Mitigations &amp; Invariant Bounds
            </h2>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-[#F0EDFF] leading-relaxed">
        {/* Card 1: 4x Anisotropy Distortions */}
        <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-2">
          <div className="flex items-center gap-2 text-[#A259FF] font-semibold">
            <Layers className="w-4 h-4" />
            1. 4x Z-Anisotropy Distortion Mitigation
          </div>
          <p className="text-[#A5A1B8]">
            Physical scaling is <span className="font-mono text-white">z = 1.625 µm</span> and <span className="font-mono text-white">y, x = 0.40625 µm</span>.
            The ratio <span className="font-mono text-[#A259FF]">1.625 / 0.40625 = 4.0</span> exactly.
          </p>
          <div className="p-2.5 rounded bg-[#141122] border border-[#352C58] font-mono text-[11px] text-emerald-400">
            D&sup2; = 1.625&sup2; &Delta;z&sup2; + 0.40625&sup2; (&Delta;y&sup2; + &Delta;x&sup2;) &le; 7.0&sup2;
          </div>
          <p className="text-[#A5A1B8] text-[11px]">
            <strong>Mitigation:</strong> Never perform isotropic 3D convolutions without resampling, or apply 3D distance transforms in raw voxel space. Convolution kernels must be anisotropic (e.g. 3&times;7&times;7) or inputs rescaled before computing spatial gradients.
          </p>
        </div>

        {/* Card 2: Sparse-Label Over-Prediction Penalty */}
        <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <AlertOctagon className="w-4 h-4" />
            2. The Node Over-Prediction Penalty Trap
          </div>
          <p className="text-[#A5A1B8]">
            Over-predicting total nodes relative to <span className="font-mono text-white">estimated_number_of_nodes</span> heavily slashes Adjusted Edge Jaccard. Unmatched predicted centroids become guaranteed <span className="font-mono text-rose-400">False Positive Edges</span> when linked across time.
          </p>
          <div className="p-2.5 rounded bg-[#141122] border border-[#352C58] font-mono text-[11px] text-rose-300">
            &part;Score / &part;FP_edge &approx; -1 / (TP_e + FP_e + FN_e) &lt; 0
          </div>
          <p className="text-[#A5A1B8] text-[11px]">
            <strong>Mitigation:</strong> Calibrate the detector probability threshold dynamically to match <span className="font-mono text-[#F0EDFF]">estimated_number_of_nodes</span>. Precision strictly dominates raw recall.
          </p>
        </div>

        {/* Card 3: Kaggle Offline Memory Budget */}
        <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Cpu className="w-4 h-4" />
            3. Kaggle Offline Inference &amp; GPU OOM Elimination
          </div>
          <p className="text-[#A5A1B8]">
            Kaggle offline notebook execution has a strict 12-hour wall-clock limit with no internet access. 4D volumes can exceed 100 GB in memory if loaded uncompressed.
          </p>
          <div className="p-2.5 rounded bg-[#141122] border border-[#352C58] font-mono text-[11px] text-slate-300">
            Zarr v3 chunks: (1, 64, 256, 256) uint16 at path '0/'
          </div>
          <p className="text-[#A5A1B8] text-[11px]">
            <strong>Mitigation:</strong> Sequential timepoint streaming directly from disk chunk slices. Normalization and float conversions happen on the fly per timepoint and are immediately garbage collected.
          </p>
        </div>

        {/* Card 4: Conservative Mitosis Logic */}
        <div className="p-4 rounded-xl bg-[#201A36] border border-[#352C58] space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            4. Metric Weighting &amp; Conservative Division Policy
          </div>
          <p className="text-[#A5A1B8]">
            Division Jaccard carries only a 0.1 weight while Edge Jaccard carries 1.0 weight. An incorrect division split (false positive) generates at least 2 FP edges, which heavily penalizes the Adjusted Edge Jaccard.
          </p>
          <div className="p-2.5 rounded bg-[#141122] border border-[#352C58] font-mono text-[11px] text-amber-300">
            Score = Adj_Edge_Jaccard + 0.1 &times; Div_Jaccard
          </div>
          <p className="text-[#A5A1B8] text-[11px]">
            <strong>Mitigation:</strong> Enforce strict geometric constraints: Daughter separation within 1.8 to 6.5 µm and symmetric distance to mother before accepting an out-degree = 2 bifurcation.
          </p>
        </div>
      </div>
    </div>
    </div>
  );
};
