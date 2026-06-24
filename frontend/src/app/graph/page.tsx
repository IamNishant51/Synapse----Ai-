"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { getConfidenceColor } from "@/lib/design-tokens";
import { getGraphSnapshot, forgetNode, getConflictEvents } from "@/lib/api";
import * as THREE from "three";
import type { GraphNode, GraphEdge } from "@/lib/types";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d").then((m) => m.default || m), { ssr: false });

interface NodeDetail extends GraphNode {
  x?: number;
  y?: number;
  z?: number;
}

const COLORS = {
  active: "#292524",
  superseded: "#777169",
  rejected: "#dc2626",
  forgotten: "#d6d3d1",
  edge: "#e7e5e4",
  particle: "#777169",
  fresh: "#292524",
  fading: "#777169",
  stale: "#a8a29e",
};

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(41,37,36,0.3)");
  gradient.addColorStop(0.2, "rgba(41,37,36,0.15)");
  gradient.addColorStop(0.5, "rgba(41,37,36,0.05)");
  gradient.addColorStop(1, "rgba(41,37,36,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function nodeColor(node: GraphNode) {
  const level = getConfidenceColor(node.confidenceScore);
  if (level === "fresh") return COLORS.fresh;
  if (level === "fading") return COLORS.fading;
  return COLORS.stale;
}

function GraphLoadingSkeleton() {
  const nodes: { cx: number; cy: number; r: number }[] = [
    { cx: 50, cy: 30, r: 6 },
    { cx: 120, cy: 20, r: 5 },
    { cx: 190, cy: 40, r: 5.5 },
    { cx: 35, cy: 100, r: 5 },
    { cx: 120, cy: 95, r: 7 },
    { cx: 200, cy: 95, r: 5 },
    { cx: 80, cy: 160, r: 5.5 },
    { cx: 160, cy: 165, r: 5 },
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 3], [1, 2], [1, 4],
    [2, 5], [3, 4], [3, 6], [4, 5],
    [4, 7], [5, 7], [6, 7],
  ];

  const nodeColor = (i: number) =>
    i === 4 ? "#292524" : i % 2 === 0 ? "#777169" : "#a8a29e";

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-canvas">
      <div className="flex flex-col items-center gap-8">
        <svg width="200" height="180" viewBox="0 0 240 200" className="overflow-visible">
          {edges.map(([si, ti], i) => {
            const s = nodes[si];
            const t = nodes[ti];
            return (
              <line
                key={`e${i}`}
                x1={s.cx} y1={s.cy} x2={t.cx} y2={t.cy}
                stroke="#d6d3d1"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray="200"
                strokeDashoffset="200"
                opacity="0"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="200" to="0"
                  dur="0.6s"
                  begin={`${0.5 + i * 0.08}s`}
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.16 1 0.3 1"
                  keyTimes="0;1"
                />
                <animate
                  attributeName="opacity"
                  from="0" to="0.35"
                  dur="0.3s"
                  begin={`${0.5 + i * 0.08}s`}
                  fill="freeze"
                />
              </line>
            );
          })}
          {nodes.map((n, i) => (
            <g key={`n${i}`} opacity="0">
              <animate
                attributeName="opacity"
                from="0" to="1"
                dur="0.4s"
                begin={`${i * 0.15}s`}
                fill="freeze"
              />
              <circle cx={n.cx} cy={n.cy} r="0">
                <animate
                  attributeName="r"
                  from="0" to={n.r * 3}
                  dur="0.4s"
                  begin={`${i * 0.15}s`}
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.16 1 0.3 1"
                  keyTimes="0;1"
                />
                <animate
                  attributeName="opacity"
                  from="0.3" to="0"
                  dur="0.4s"
                  begin={`${i * 0.15}s`}
                  fill="freeze"
                />
              </circle>
              <circle cx={n.cx} cy={n.cy} r={n.r} fill={nodeColor(i)}>
                <animate
                  attributeName="r"
                  from="0" to={n.r}
                  dur="0.35s"
                  begin={`${i * 0.15}s`}
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.16 1 0.3 1"
                  keyTimes="0;1"
                >
                </animate>
                <animate
                  attributeName="opacity"
                  from="0" to="1"
                  dur="0.2s"
                  begin={`${i * 0.15 + 0.15}s`}
                  fill="freeze"
                />
              </circle>
              <circle
                cx={n.cx} cy={n.cy} r={n.r + 4}
                fill="none"
                stroke={nodeColor(i)}
                strokeWidth="0.5"
                opacity="0.15"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${n.cx} ${n.cy}`}
                  to={`360 ${n.cx} ${n.cy}`}
                  dur="5s"
                  repeatCount="indefinite"
                  begin={`${i * 0.15 + 0.5}s`}
                />
              </circle>
            </g>
          ))}
        </svg>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0s", animationDuration: "1.2s" }} />
              <span className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0.15s", animationDuration: "1.2s" }} />
              <span className="w-2 h-2 rounded-full bg-muted-soft animate-bounce" style={{ animationDelay: "0.3s", animationDuration: "1.2s" }} />
            </div>
            <span className="text-sm font-medium text-muted tracking-wide">Loading memory graph</span>
          </div>
          <p className="text-xs text-muted-soft tracking-wide">Nodes and edges forming</p>
        </div>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const fgRef = useRef<any>(null);
  const glowTexRef = useRef<THREE.CanvasTexture | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
         const { width, height } = entries[0].contentRect;
         setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    glowTexRef.current = createGlowTexture();
    const load = async () => {
      try {
        const [data, events] = await Promise.all([
          getGraphSnapshot(),
          getConflictEvents(),
        ]);
        setNodes(data.nodes);
        setEdges(data.edges);
        setConflictCount(events.filter((e) => e.status === "pending").length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode({
      id: node.id,
      label: node.label,
      summary: node.summary || "",
      confidenceScore: node.confidenceScore ?? 0.5,
      sourceProvenance: node.sourceProvenance || "",
      lastReinforcedAt: node.lastReinforcedAt || "",
      connectionCount: node.connectionCount || 0,
      status: node.status || "active",
      isDecisionType: node.isDecisionType || false,
    });
    if (fgRef.current) {
      fgRef.current.cameraPosition(
        { x: node.x * 1.4, y: node.y * 1.4, z: node.z * 1.4 + 80 },
        { x: node.x, y: node.y, z: node.z },
        800,
      );
    }
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    if (fgRef.current) {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 250 }, { x: 0, y: 0, z: 0 }, 800);
    }
  }, []);

  const handleForgetNode = useCallback(async () => {
    if (!selectedNode) return;
    try {
      await forgetNode(selectedNode.id);
      setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
      setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    } catch {}
  }, [selectedNode]);

  const nodeThreeObject = useCallback(
    (node: any) => {
      const color = nodeColor(node);
      const group = new THREE.Group();

      const sphereGeo = new THREE.SphereGeometry(node.isDecisionType ? 7 : 5, 32, 32);
      const sphereMat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(sphere);

      if (glowTexRef.current) {
        const spriteMat = new THREE.SpriteMaterial({
          map: glowTexRef.current,
          blending: THREE.NormalBlending,
          transparent: true,
          opacity: 0.4,
          color,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(30, 30, 1);
        group.add(sprite);
      }

      const haloGeo = new THREE.TorusGeometry(node.isDecisionType ? 12 : 9, 0.3, 16, 64);
      const haloMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = -Math.PI / 2;
      group.add(halo);

      return group;
    },
    [],
  );

  const linkThreeObject = useCallback((link: any) => {
    const color = link.confidence >= 0.8 ? COLORS.particle : COLORS.edge;
    const geo = new THREE.BufferGeometry();
    const points = [
      link.source.x || 0,
      link.source.y || 0,
      link.source.z || 0,
      link.target.x || 0,
      link.target.y || 0,
      link.target.z || 0,
    ];
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
    return new THREE.Line(geo, mat);
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n, id: n.id, label: n.label })),
      links: edges.map((e) => ({ source: e.source, target: e.target, confidence: e.confidence })),
    }),
    [nodes, edges],
  );

  const empty = !loading && nodes.length === 0 && !error;

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden relative bg-canvas selection:bg-gradient-mint/40">
      <div ref={containerRef} className="flex-1 relative h-full w-full min-w-0 min-h-0" onDoubleClick={handleBackgroundClick}>
        {loading && <GraphLoadingSkeleton />}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-canvas">
            <EmptyState icon="graph" title="Could not load graph" description={error} />
          </div>
        )}

        {empty && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-canvas">
            <EmptyState
              icon="graph"
              title="Your graph is empty"
              description="Ingest a GitHub repo, paste a conversation, or upload a PDF to start building your knowledge graph."
            />
          </div>
        )}

        {!empty && !loading && !error && (
          <>
            {dimensions.width > 0 && dimensions.height > 0 && (
              <ForceGraph3D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeThreeObject={nodeThreeObject}
                linkThreeObject={linkThreeObject}
                linkWidth={0.8}
                linkOpacity={0.3}
                linkDirectionalParticles={1}
                linkDirectionalParticleSpeed={0.003}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleColor={() => COLORS.particle}
                linkCurvature={0.05}
                onNodeClick={handleNodeClick}
                backgroundColor="#f5f5f5"
                nodeLabel="label"
                nodeResolution={24}
                d3VelocityDecay={0.3}
                d3AlphaDecay={0.02}
                warmupTicks={100}
                cooldownTicks={30}
                rendererConfig={{ antialias: true, alpha: true }}
              />
            )}

            <div className="absolute bottom-20 md:bottom-6 left-4 md:left-6 flex flex-col md:flex-row items-start md:items-center gap-2.5 md:gap-4 px-4 py-3 rounded-full bg-surface-card border border-hairline shadow-md z-10 pointer-events-none md:pointer-events-auto">
              <span className="text-[11px] text-muted font-semibold uppercase tracking-wider">Memory Health</span>
              <div className="flex items-center gap-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-xs text-body font-medium">Fresh</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-confidence-fading" />
                  <span className="text-xs text-body font-medium">Fading</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-confidence-stale" />
                  <span className="text-xs text-body font-medium">Stale</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex absolute top-6 left-6 items-center gap-2.5 px-4 py-2 rounded-full bg-surface-card/85 backdrop-blur-md border border-hairline z-10 pointer-events-none shadow-sm">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="#777169" strokeWidth="1" />
                <path d="M6 3v3l2 2" stroke="#777169" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-body">Drag to orbit &middot; Scroll to zoom &middot; Click node</span>
            </div>

            <Link
              href="/resolve"
              className="absolute top-4 md:top-6 right-4 md:right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-card border border-hairline z-10 hover:bg-surface-strong transition-all duration-150 cursor-pointer shadow-md"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="#e0a328" strokeWidth="1.3" />
                <path d="M7 4V7.5M7 10V10.01" stroke="#e0a328" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-semibold text-body">What Changed</span>
              {conflictCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-conflict-warning/15 border border-conflict-warning/30 text-xs font-bold text-conflict-warning">
                  {conflictCount}
                </span>
              )}
            </Link>
          </>
        )}
      </div>

      {selectedNode && !empty && (
        <div className="absolute inset-x-0 bottom-0 top-auto md:relative md:w-[380px] md:h-full border-t md:border-t-0 md:border-l border-hairline bg-surface-card/95 md:bg-surface-card backdrop-blur-xl md:backdrop-blur-none overflow-y-auto scrollbar-thin z-20 max-h-[60vh] md:max-h-full rounded-t-2xl md:rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
          <div className="p-6 pb-24 md:pb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: nodeColor(selectedNode) }}
                />
                <h3 className="text-base font-semibold text-ink tracking-tight">{selectedNode.label}</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  if (fgRef.current) fgRef.current.cameraPosition({ x: 0, y: 0, z: 250 }, { x: 0, y: 0, z: 0 }, 800);
                }}
                className="text-muted hover:text-ink transition-colors duration-150 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <span className="caption-upper text-muted" style={{ fontSize: "10px" }}>Confidence</span>
                <div className="mt-1.5">
                  <ConfidenceBadge level={getConfidenceColor(selectedNode.confidenceScore)} score={selectedNode.confidenceScore} />
                </div>
              </div>

              {selectedNode.summary && (
                <div>
                  <span className="caption-upper text-muted" style={{ fontSize: "10px" }}>Summary</span>
                  <p className="mt-1.5 text-[14px] text-body leading-relaxed">{selectedNode.summary}</p>
                </div>
              )}

              {selectedNode.sourceProvenance && (
                <div>
                  <span className="caption-upper text-muted" style={{ fontSize: "10px" }}>Source</span>
                  <p className="mt-1.5 text-sm text-body font-medium">{selectedNode.sourceProvenance}</p>
                </div>
              )}

              <div>
                <span className="caption-upper text-muted" style={{ fontSize: "10px" }}>Last reinforced</span>
                <p className="mt-1.5 text-sm text-body">{selectedNode.lastReinforcedAt || "Unknown"}</p>
              </div>

              <div>
                <span className="caption-upper text-muted" style={{ fontSize: "10px" }}>Status</span>
                <div className="mt-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      selectedNode.status === "active"
                        ? "bg-semantic-success/10 text-semantic-success"
                        : selectedNode.status === "superseded"
                          ? "bg-conflict-warning/10 text-conflict-warning"
                          : "bg-surface-strong text-muted"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedNode.status === "active"
                          ? "bg-semantic-success"
                          : selectedNode.status === "superseded"
                            ? "bg-conflict-warning"
                            : "bg-muted"
                      }`}
                    />
                    {selectedNode.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-hairline">
              <button
                onClick={handleForgetNode}
                className="w-full px-4 py-2.5 rounded-full bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-sm font-semibold hover:bg-semantic-error/20 transition-all duration-150 cursor-pointer"
              >
                Forget this node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

