import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CellNode, CellEdge, PHYSICAL_SCALING } from '../types';
import { calculatePhysicalDistance } from '../utils/geoUtils';
import { Play, Pause, SkipBack, SkipForward, Eye, Box, RotateCcw, Crosshair } from 'lucide-react';

interface Visualizer3DProps {
  gtNodes: CellNode[];
  gtEdges: CellEdge[];
  predNodes: CellNode[];
  predEdges: CellEdge[];
  matchedGtIds: Set<number>;
  matchedPredIds: Set<number>;
  currentTime: number;
  onTimeChange: (t: number) => void;
  maxTime: number;
  selectedNodeId?: number | null;
  onSelectNodeId?: (id: number | null) => void;
  ancestorNodeIds?: Set<number>;
  progenyNodeIds?: Set<number>;
}

export const Visualizer3D: React.FC<Visualizer3DProps> = ({
  gtNodes,
  gtEdges,
  predNodes,
  predEdges,
  currentTime,
  onTimeChange,
  maxTime,
  matchedGtIds,
  matchedPredIds,
  selectedNodeId = null,
  onSelectNodeId,
  ancestorNodeIds = new Set<number>(),
  progenyNodeIds = new Set<number>(),
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameId = useRef<number>(0);

  const [usePhysicalScale, setUsePhysicalScale] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<{ node: CellNode; isGt: boolean } | null>(null);
  const [show7UmSphere, setShow7UmSphere] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'both' | 'gt' | 'pred'>('both');
  const [colorMode, setColorMode] = useState<'lineage' | 'status' | 'time'>('lineage');
  const [tailLength, setTailLength] = useState<number>(2); // t - k ... t
  const [showMotionVectors, setShowMotionVectors] = useState<boolean>(true);

  // Sync external selectedNodeId with local selectedNode
  useEffect(() => {
    if (selectedNodeId === null || selectedNodeId === undefined) {
      setSelectedNode(null);
      return;
    }
    const found =
      predNodes.find(n => n.node_id === selectedNodeId) ||
      gtNodes.find(n => n.node_id === selectedNodeId);
    if (found) {
      setSelectedNode({
        node: found,
        isGt: gtNodes.some(n => n.node_id === selectedNodeId),
      });
    }
  }, [selectedNodeId, predNodes, gtNodes]);

  // Lineage color palette (distinct high-contrast hues)
  const lineageColors: Record<number, number> = {
    1: 0x38bdf8, // sky blue
    2: 0xec4899, // pink
    201: 0xf43f5e, // rose
    202: 0xfb7185, // light rose
    3: 0x10b981, // emerald
    301: 0x34d399, // mint
    302: 0x6ee7b7, // seafoam
    4: 0xf59e0b, // amber
    5: 0x8b5cf6, // purple
  };

  // Setup Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120E20);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(60, 60, 90);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(50, 100, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xA259FF, 0.45);
    dirLight2.position.set(-50, -50, -50);
    scene.add(dirLight2);

    // Simple Orbit Controls simulation
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let spherical = { radius: 100, theta: 0.8, phi: 1.1 };
    const center = new THREE.Vector3(45, 45, 45);

    const updateCameraPos = () => {
      camera.position.x = center.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = center.y + spherical.radius * Math.cos(spherical.phi);
      camera.position.z = center.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(center);
    };
    updateCameraPos();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMousePos.x;
      const dy = e.clientY - prevMousePos.y;

      spherical.theta -= dx * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.008));

      updateCameraPos();
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(20, Math.min(250, spherical.radius + e.deltaY * 0.1));
      updateCameraPos();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Render loop
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Scene elements whenever nodes, edges, time, or toggles change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear previous dynamic meshes (keep lights)
    const toRemove: THREE.Object3D[] = [];
    scene.children.forEach(child => {
      if (!(child instanceof THREE.Light)) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => scene.remove(obj));

    // Coordinate conversion helper: maps voxel/physical coordinates to 3D Three.js space
    // Three.js: X -> X, Y -> Y (up), Z -> Z (depth)
    // We center around (z: 25, y: 110, x: 120)
    const centerVoxel = { z: 25, y: 110, x: 120 };
    const getPos = (n: CellNode): THREE.Vector3 => {
      if (usePhysicalScale) {
        // Physical coordinates in µm
        const z_um = n.z * PHYSICAL_SCALING.VOXEL_Z;
        const y_um = n.y * PHYSICAL_SCALING.VOXEL_Y;
        const x_um = n.x * PHYSICAL_SCALING.VOXEL_X;
        const cz_um = centerVoxel.z * PHYSICAL_SCALING.VOXEL_Z;
        const cy_um = centerVoxel.y * PHYSICAL_SCALING.VOXEL_Y;
        const cx_um = centerVoxel.x * PHYSICAL_SCALING.VOXEL_X;
        return new THREE.Vector3(
          (x_um - cx_um) * 1.5 + 45,
          (z_um - cz_um) * 1.5 + 45, // Map Z (anisotropic axis) to vertical for microscope view
          (y_um - cy_um) * 1.5 + 45
        );
      } else {
        // Raw voxel space (distorted by 4x anisotropy)
        return new THREE.Vector3(
          (n.x - centerVoxel.x) * 0.7 + 45,
          (n.z - centerVoxel.z) * 0.7 + 45,
          (n.y - centerVoxel.y) * 0.7 + 45
        );
      }
    };

    // Add 3D Bounding Box & Scale Grid
    const boxSize = usePhysicalScale ? 75 : 60;
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.8 })
    );
    boxLine.position.set(45, 45, 45);
    scene.add(boxLine);

    // Floor Grid
    const grid = new THREE.GridHelper(boxSize, 10, 0x334155, 0x172033);
    grid.position.set(45, 45 - boxSize / 2, 45);
    scene.add(grid);

    // Filter nodes by view mode
    const displayGt = viewMode === 'both' || viewMode === 'gt';
    const displayPred = viewMode === 'both' || viewMode === 'pred';

    // Set of node IDs in active fate trace
    const fateSet = new Set<number>();
    ancestorNodeIds.forEach(id => fateSet.add(id));
    progenyNodeIds.forEach(id => fateSet.add(id));
    if (selectedNodeId !== null) fateSet.add(selectedNodeId);

    // Helper to get color
    const getNodeColor = (node: CellNode, isGt: boolean): number => {
      if (node.node_id === selectedNodeId) {
        return 0x00FFA3; // Neon Emerald for Selected
      }
      if (fateSet.has(node.node_id)) {
        return 0x00FFA3; // Neon Emerald for Fate trace
      }
      if (colorMode === 'lineage') {
        return lineageColors[node.track_id || 1] || 0x94a3b8;
      }
      if (colorMode === 'status') {
        if (node.is_division_mother || node.is_division_daughter) return 0xFF4B4B; // coral red for division
        if (isGt) {
          return matchedGtIds.has(node.node_id) ? 0x22c55e : 0xeab308; // green TP, yellow FN
        } else {
          return matchedPredIds.has(node.node_id) ? 0x22c55e : 0xef4444; // green TP, red FP
        }
      }
      // By Time
      const hue = (node.t / (maxTime || 1)) * 0.7;
      const col = new THREE.Color();
      col.setHSL(hue, 0.9, 0.5);
      return col.getHex();
    };

    // Calculate minimum time for trajectory tails
    const minTailTime = tailLength === 99 ? 0 : Math.max(0, currentTime - tailLength);

    // Draw trajectory lines for Ground Truth
    if (displayGt) {
      for (const edge of gtEdges) {
        const src = gtNodes.find(n => n.node_id === edge.source_id);
        const tgt = gtNodes.find(n => n.node_id === edge.target_id);
        if (src && tgt) {
          const isCurrentEdge = src.t === currentTime - 1 && tgt.t === currentTime;
          const isWithinTail = src.t >= minTailTime && tgt.t <= currentTime;

          if (isWithinTail || (tailLength === 99)) {
            const p1 = getPos(src);
            const p2 = getPos(tgt);
            const points = [p1, p2];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

            const isFateEdge = fateSet.has(edge.source_id) && fateSet.has(edge.target_id);
            const isDiv = edge.is_division_edge;

            let edgeColor = isDiv ? 0xFF4B4B : 0x38bdf8;
            let opacity = isCurrentEdge ? 0.95 : 0.4;
            if (isFateEdge) {
              edgeColor = 0x00FFA3;
              opacity = 1.0;
            }

            const mat = new THREE.LineBasicMaterial({
              color: edgeColor,
              transparent: true,
              opacity,
              linewidth: isFateEdge ? 3 : (isCurrentEdge ? 2 : 1),
            });
            const line = new THREE.Line(lineGeo, mat);
            scene.add(line);

            // Motion Vector Arrow at target for active transition
            if (showMotionVectors && isCurrentEdge) {
              const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
              const arrowHelper = new THREE.ArrowHelper(dir, p1, p1.distanceTo(p2), edgeColor, 1.8, 1.0);
              scene.add(arrowHelper);
            }
          }
        }
      }
    }

    // Draw trajectory lines for Predictions (dashed or slightly offset)
    if (displayPred && viewMode !== 'gt') {
      for (const edge of predEdges) {
        const src = predNodes.find(n => n.node_id === edge.source_id);
        const tgt = predNodes.find(n => n.node_id === edge.target_id);
        if (src && tgt) {
          const isCurrentEdge = src.t === currentTime - 1 && tgt.t === currentTime;
          const isWithinTail = src.t >= minTailTime && tgt.t <= currentTime;

          if (isWithinTail || (tailLength === 99)) {
            const p1 = getPos(src);
            const p2 = getPos(tgt);
            if (viewMode === 'both') {
              p1.x += 0.3;
              p2.x += 0.3;
            }
            const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);

            const isFateEdge = fateSet.has(edge.source_id) && fateSet.has(edge.target_id);
            const isDiv = edge.is_division_edge;

            let edgeColor = isDiv ? 0xFF4B4B : 0xA259FF;
            let opacity = isCurrentEdge ? 0.95 : 0.35;
            if (isFateEdge) {
              edgeColor = 0x00FFA3;
              opacity = 1.0;
            }

            const mat = new THREE.LineDashedMaterial({
              color: edgeColor,
              dashSize: 1,
              gapSize: 0.5,
              transparent: true,
              opacity,
            });
            const line = new THREE.Line(lineGeo, mat);
            line.computeLineDistances();
            scene.add(line);
          }
        }
      }
    }

    // Draw Nodes (Spheres)
    const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const predSphereGeo = new THREE.SphereGeometry(1.0, 14, 14);

    // Ground Truth Nodes
    if (displayGt) {
      gtNodes.forEach(node => {
        const isCurrent = node.t === currentTime;
        const isWithinTail = node.t >= minTailTime && node.t <= currentTime;
        if (!isCurrent && !isWithinTail && tailLength !== 99) return;

        const pos = getPos(node);
        const color = getNodeColor(node, true);
        const isSelected = selectedNodeId === node.node_id;
        const isFate = fateSet.has(node.node_id);

        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.3,
          metalness: 0.1,
          transparent: !isCurrent && !isFate,
          opacity: (isCurrent || isFate) ? 1.0 : 0.25,
        });

        const mesh = new THREE.Mesh(sphereGeo, mat);
        mesh.position.copy(pos);
        if (isSelected || isFate) {
          mesh.scale.set(1.4, 1.4, 1.4);
        }
        mesh.userData = { node, isGt: true };
        scene.add(mesh);

        // Highlight ring if selected or division
        if ((node.is_division_mother && isCurrent) || isSelected) {
          const ringGeo = new THREE.RingGeometry(1.8, 2.2, 24);
          const ringMat = new THREE.MeshBasicMaterial({
            color: isSelected ? 0x00FFA3 : 0xFF4B4B,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.copy(pos);
          ring.rotation.x = Math.PI / 2;
          scene.add(ring);
        }
      });
    }

    // Predicted Nodes
    if (displayPred) {
      predNodes.forEach(node => {
        const isCurrent = node.t === currentTime;
        const isWithinTail = node.t >= minTailTime && node.t <= currentTime;
        if (!isCurrent && !isWithinTail && tailLength !== 99) return;

        const pos = getPos(node);
        if (viewMode === 'both') {
          pos.x += 0.3; // Offset
        }
        const color = getNodeColor(node, false);
        const isSelected = selectedNodeId === node.node_id;
        const isFate = fateSet.has(node.node_id);

        const mat = new THREE.MeshStandardMaterial({
          color,
          wireframe: viewMode === 'both' && !isSelected && !isFate,
          transparent: !isCurrent && !isFate,
          opacity: (isCurrent || isFate) ? 0.95 : 0.2,
        });

        const mesh = new THREE.Mesh(predSphereGeo, mat);
        mesh.position.copy(pos);
        if (isSelected || isFate) {
          mesh.scale.set(1.35, 1.35, 1.35);
        }
        mesh.userData = { node, isGt: false };
        scene.add(mesh);
      });
    }

    // 7.0 µm Distance Cutoff Indicator
    // If a node is selected, render a wireframe 7.0 µm matching sphere!
    if (selectedNode && show7UmSphere) {
      const pos = getPos(selectedNode.node);
      const radiusUm = PHYSICAL_SCALING.MAX_MATCHING_DISTANCE_UM; // 7.0 µm

      if (usePhysicalScale) {
        // In physical scale, it's an exact isotropic sphere of radius 7.0 µm * scale (1.5)
        const sphereRadius = radiusUm * 1.5;
        const wireGeo = new THREE.SphereGeometry(sphereRadius, 20, 16);
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x6A45FF, // bi[o]hub Electric Violet
          wireframe: true,
          transparent: true,
          opacity: 0.5,
        });
        const sphereMesh = new THREE.Mesh(wireGeo, wireMat);
        sphereMesh.position.copy(pos);
        scene.add(sphereMesh);
      } else {
        // In voxel space, 7.0 µm is an ANISOTROPIC ELLIPSOID:
        // Dz_max = 7.0 / 1.625 = 4.307 voxels
        // Dxy_max = 7.0 / 0.40625 = 17.23 voxels!
        // 4x wider in XY than Z!
        const rZ = (radiusUm / PHYSICAL_SCALING.VOXEL_Z) * 0.7;
        const rXY = (radiusUm / PHYSICAL_SCALING.VOXEL_Y) * 0.7;
        const ellipGeo = new THREE.SphereGeometry(1, 20, 16);
        ellipGeo.scale(rXY, rZ, rXY); // Scale Y is Three.js up (Z in microscopy)
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0xA259FF, // bi[o]hub Amethyst
          wireframe: true,
          transparent: true,
          opacity: 0.55,
        });
        const ellipMesh = new THREE.Mesh(ellipGeo, wireMat);
        ellipMesh.position.copy(pos);
        scene.add(ellipMesh);
      }
    }
  }, [
    gtNodes,
    gtEdges,
    predNodes,
    predEdges,
    currentTime,
    usePhysicalScale,
    selectedNode,
    selectedNodeId,
    ancestorNodeIds,
    progenyNodeIds,
    show7UmSphere,
    viewMode,
    colorMode,
    tailLength,
    showMotionVectors,
    matchedGtIds,
    matchedPredIds,
    maxTime,
  ]);

  // Click on canvas to select node
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);

    for (const hit of intersects) {
      if (hit.object.userData && hit.object.userData.node) {
        const n = hit.object.userData.node as CellNode;
        setSelectedNode({
          node: n,
          isGt: hit.object.userData.isGt,
        });
        onSelectNodeId?.(n.node_id);
        return;
      }
    }
  };

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      onTimeChange(currentTime >= maxTime ? 0 : currentTime + 1);
    }, 1200);
    return () => clearInterval(timer);
  }, [isPlaying, currentTime, maxTime, onTimeChange]);

  return (
    <div className="flex flex-col h-full bg-[#120E20] rounded-xl border border-[#352C58] overflow-hidden shadow-2xl">
      {/* 3D Viewport Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1F1A35] border-b border-[#352C58] text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Box className="w-4 h-4 text-[#A259FF]" /> 3D Spatial Viewport
          </span>
          <span className="px-2 py-0.5 rounded bg-[#141122] text-[#F0EDFF] font-mono text-[11px] border border-[#352C58]">
            t = {currentTime} / {maxTime}
          </span>
          {selectedNodeId !== null && (
            <span className="px-2 py-0.5 rounded bg-[#00FFA3]/15 text-[#00FFA3] font-mono text-[11px] border border-[#00FFA3]/40">
              Fate Node #{selectedNodeId}
            </span>
          )}
        </div>

        {/* View Mode & Scale Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUsePhysicalScale(!usePhysicalScale)}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              usePhysicalScale
                ? 'bg-[#6A45FF]/25 text-[#F0EDFF] border border-[#6A45FF]/60'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
            title="Toggle between real physical space (µm) and raw voxel space (4x z-stretched)"
          >
            {usePhysicalScale ? 'Physical Scale (µm)' : 'Raw Voxel Space'}
          </button>

          <button
            onClick={() => setShow7UmSphere(!show7UmSphere)}
            className={`px-2 py-1 rounded flex items-center gap-1 border ${
              show7UmSphere
                ? 'bg-[#6A45FF]/20 text-[#F0EDFF] border-[#6A45FF]/60'
                : 'bg-[#181528] text-[#A5A1B8] border-[#352C58]'
            }`}
            title="7.0 µm Bipartite Matching Sphere"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#A259FF]" />
            7.0µm Gate
          </button>

          {/* Tail length selector */}
          <select
            value={tailLength}
            onChange={e => setTailLength(Number(e.target.value))}
            className="bg-[#141122] border border-[#352C58] text-[#F0EDFF] px-2 py-1 rounded text-xs focus:outline-none"
            title="Historical trajectory tail length (t - k ... t)"
          >
            <option value={1}>Tails: t - 1</option>
            <option value={2}>Tails: t - 2 (Default)</option>
            <option value={3}>Tails: t - 3</option>
            <option value={99}>Tails: Full History</option>
          </select>

          {/* Motion Vector Toggle */}
          <button
            onClick={() => setShowMotionVectors(!showMotionVectors)}
            className={`px-2 py-1 rounded border text-xs flex items-center gap-1 ${
              showMotionVectors
                ? 'bg-[#00FFA3]/20 text-[#00FFA3] border-[#00FFA3]/40'
                : 'bg-[#141122] text-[#A5A1B8] border-[#352C58]'
            }`}
            title="Toggle instantaneous velocity vectors"
          >
            Motion Vectors
          </button>

          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value as 'both' | 'gt' | 'pred')}
            className="bg-[#141122] border border-[#352C58] text-[#F0EDFF] px-2 py-1 rounded text-xs focus:outline-none"
          >
            <option value="both">View: GT + Pred</option>
            <option value="gt">View: GT Only</option>
            <option value="pred">View: Pred Only</option>
          </select>

          <select
            value={colorMode}
            onChange={e => setColorMode(e.target.value as 'lineage' | 'status' | 'time')}
            className="bg-[#141122] border border-[#352C58] text-[#F0EDFF] px-2 py-1 rounded text-xs focus:outline-none"
          >
            <option value="lineage">Color: Lineage Track</option>
            <option value="status">Color: TP / FP / Division</option>
            <option value="time">Color: Time Gradient</option>
          </select>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 min-h-[420px] w-full" ref={containerRef} onClick={handleCanvasClick}>
        {/* Info Legend Overlay */}
        <div className="absolute top-3 left-3 bg-[#181528]/85 backdrop-blur-md p-2.5 rounded-lg border border-[#352C58] text-[11px] text-[#F0EDFF] pointer-events-none space-y-1">
          <div className="font-semibold text-white pb-1 border-b border-[#352C58] flex items-center justify-between">
            <span>Coordinate Scaling</span>
            <span className="text-[10px] font-mono text-[#A259FF]">7.0 µm Gating</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6A45FF]"></span>
            <span>z: 1.625 µm/vox (4x anisotropy)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A259FF]"></span>
            <span>y, x: 0.40625 µm/vox</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>Cutoff: D &le; 7.0 µm in physical space</span>
          </div>
        </div>

        {/* Selected Cell Inspector Overlay */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 max-w-xs bg-[#181528]/95 backdrop-blur-md p-3.5 rounded-lg border border-[#6A45FF]/50 text-xs text-[#F0EDFF] shadow-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-[#352C58] pb-1.5">
              <span className="font-semibold text-[#A259FF] flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5" /> {selectedNode.isGt ? 'Ground Truth' : 'Predicted'} Node #{selectedNode.node.node_id}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#A5A1B8] hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
              <span className="text-[#A5A1B8]">Time (t):</span>
              <span>{selectedNode.node.t}</span>
              <span className="text-[#A5A1B8]">Track ID:</span>
              <span className="text-[#A259FF] font-semibold">{selectedNode.node.track_id}</span>
              <span className="text-[#A5A1B8]">Voxel (z,y,x):</span>
              <span>
                ({selectedNode.node.z.toFixed(1)}, {selectedNode.node.y.toFixed(1)}, {selectedNode.node.x.toFixed(1)})
              </span>
              <span className="text-[#A5A1B8]">Physical (µm):</span>
              <span className="text-emerald-400 font-semibold">
                ({(selectedNode.node.z * PHYSICAL_SCALING.VOXEL_Z).toFixed(2)},{' '}
                {(selectedNode.node.y * PHYSICAL_SCALING.VOXEL_Y).toFixed(2)},{' '}
                {(selectedNode.node.x * PHYSICAL_SCALING.VOXEL_X).toFixed(2)})
              </span>
              {selectedNode.node.is_division_mother && (
                <div className="col-span-2 mt-1 py-1 px-2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-sans">
                  Mitotic Division Mother Node (out-degree = 2)
                </div>
              )}
              <div className="col-span-2 mt-2 pt-2 border-t border-[#352C58] flex items-center justify-between">
                <button
                  onClick={() => onSelectNodeId?.(selectedNode.node.node_id === selectedNodeId ? null : selectedNode.node.node_id)}
                  className={`w-full py-1 px-2 rounded text-center font-sans font-semibold text-[11px] transition ${
                    selectedNode.node.node_id === selectedNodeId
                      ? 'bg-[#00FFA3]/20 text-[#00FFA3] border border-[#00FFA3]/50'
                      : 'bg-[#6A45FF] text-white hover:bg-[#7D5CFF]'
                  }`}
                >
                  {selectedNode.node.node_id === selectedNodeId ? '✓ Tracing Lineage Fate' : '⚡ Trace Bidirectional Fate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Scrubber Bar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-[#181528] border-t border-[#352C58] text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onTimeChange(Math.max(0, currentTime - 1))}
            className="p-1.5 rounded bg-[#251E3D] hover:bg-[#322954] text-[#F0EDFF] transition-colors border border-[#483B75]"
            title="Previous Timeframe"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded bg-[#6A45FF] hover:bg-[#7D5CFF] text-white transition-colors shadow-sm"
            title={isPlaying ? 'Pause' : 'Play Timeline'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onTimeChange(Math.min(maxTime, currentTime + 1))}
            className="p-1.5 rounded bg-[#251E3D] hover:bg-[#322954] text-[#F0EDFF] transition-colors border border-[#483B75]"
            title="Next Timeframe"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <span className="font-mono text-[#A5A1B8] text-[11px]">t=0</span>
          <input
            type="range"
            min={0}
            max={maxTime}
            step={1}
            value={currentTime}
            onChange={e => onTimeChange(Number(e.target.value))}
            className="flex-1 accent-[#6A45FF] cursor-pointer h-1.5 bg-[#141122] rounded-lg appearance-none"
          />
          <span className="font-mono text-[#A5A1B8] text-[11px]">t={maxTime}</span>
        </div>

        <button
          onClick={() => {
            onTimeChange(0);
            setSelectedNode(null);
          }}
          className="p-1.5 rounded bg-[#251E3D] hover:bg-[#322954] text-[#A5A1B8] hover:text-white transition-colors border border-[#483B75]"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
