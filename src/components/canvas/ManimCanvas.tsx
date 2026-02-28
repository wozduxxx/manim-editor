/**
 * ManimCanvas — two-layer architecture
 *
 * LAYER 1: <canvas> Preview (Canvas 2D, synchronous)
 *   - Drawn every time Redux state changes (useEffect)
 *   - Instant feedback: color, size, position, selection highlight
 *   - Coordinate system: center = (W/2, H/2), 1 unit = SCALE px
 *
 * LAYER 2: manim-web Scene (WebGL, async)
 *   - Created fresh only when Play is pressed
 *   - Mounted in a div that overlays the preview canvas
 *   - Hidden when not playing, preview canvas shown instead
 *
 * This gives instant visual feedback during editing while keeping
 * real manim-web animations for playback.
 */

import {
  useEffect, useRef, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectObject, setIsPlaying, setCurrentStep, stopPlayback } from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { SceneObject, AnimationStep } from '../../types/scene';

// ─── manim-web (only used during playback) ────────────────────────────────────
import {
  Scene, Circle, Square,
  Create, FadeIn, FadeOut, Write,
  GrowFromCenter, Transform, Indicate,
  BLACK,
} from 'manim-web';

let MWTriangle: any = null;
try { MWTriangle = (await import('manim-web') as any).Triangle; } catch { /* fallback */ }

// ─── Canvas constants ─────────────────────────────────────────────────────────

const W = 854;
const H = 480;
const SCALE = 60; // pixels per manim unit

// Convert manim coords → canvas px
const mx = (x: number) => W / 2 + x * SCALE;
const my = (y: number) => H / 2 - y * SCALE; // Y axis flipped

// ─── 2D Preview drawing ───────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawObject(ctx: CanvasRenderingContext2D, obj: SceneObject, isSelected: boolean) {
  const { props, type } = obj;
  const [ox, oy] = props.position;
  const cx = mx(ox);
  const cy = my(oy);
  const stroke = props.strokeWidth ?? 2;
  const color = props.color;
  const fillA = props.fillOpacity;

  ctx.save();
  ctx.strokeStyle = isSelected ? '#ffffff' : color;
  ctx.lineWidth = isSelected ? stroke + 1.5 : stroke;
  ctx.fillStyle = hexToRgba(color, fillA);

  if (type === 'circle') {
    const r = (props.radius ?? 1) * SCALE;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

  } else if (type === 'square') {
    const s = (props.sideLength ?? 2) * SCALE;
    ctx.beginPath();
    ctx.rect(cx - s / 2, cy - s / 2, s, s);
    ctx.fill();
    ctx.stroke();

  } else if (type === 'triangle') {
    const s = (props.sideLength ?? 2) * SCALE;
    const h = s * Math.sqrt(3) / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 2 / 3);         // top
    ctx.lineTo(cx + s / 2, cy + h / 3);      // bottom right
    ctx.lineTo(cx - s / 2, cy + h / 3);      // bottom left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);

    if (type === 'circle') {
      const r = (props.radius ?? 1) * SCALE + 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const s = (props.sideLength ?? 2) * SCALE + 10;
      ctx.beginPath();
      ctx.rect(cx - s / 2, cy - s / 2, s, s);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function renderPreviewFrame(
  canvas: HTMLCanvasElement,
  objects: SceneObject[],
  selectedId: string | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  const gridStep = SCALE; // 1 unit grid
  for (let x = W / 2 % gridStep; x < W; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = H / 2 % gridStep; y < H; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  // Draw objects (non-selected first, selected on top)
  const nonSel = objects.filter(o => o.visible && o.id !== selectedId);
  const sel = objects.filter(o => o.visible && o.id === selectedId);
  for (const obj of [...nonSel, ...sel]) {
    drawObject(ctx, obj, obj.id === selectedId);
  }

  // Object labels
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  for (const obj of objects.filter(o => o.visible)) {
    const [ox, oy] = obj.props.position;
    ctx.fillStyle = obj.id === selectedId ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)';
    ctx.fillText(obj.label, mx(ox), my(oy) - (obj.props.radius ?? obj.props.sideLength ?? 2) * SCALE - 10);
  }
}

// ─── manim-web mobject factory ────────────────────────────────────────────────

function buildMobject(obj: SceneObject): any {
  const common = {
    color: obj.props.color,
    fillOpacity: obj.props.fillOpacity,
    strokeWidth: obj.props.strokeWidth ?? 2,
  };
  switch (obj.type) {
    case 'circle':
      return new Circle({ ...common, radius: obj.props.radius ?? 1 });
    case 'square':
      return new Square({ ...common, sideLength: obj.props.sideLength ?? 2 });
    case 'triangle':
      return MWTriangle
        ? new MWTriangle({ ...common, sideLength: obj.props.sideLength ?? 2 })
        : new Square({ ...common, sideLength: obj.props.sideLength ?? 2 });
  }
}

function applyPos(mob: any, pos: [number, number, number]) {
  if (pos[0] !== 0 || pos[1] !== 0 || pos[2] !== 0) mob.moveTo?.(pos);
}

async function runStep(
  scene: Scene,
  step: AnimationStep,
  mobMap: Map<string, any>,
  onScene: Set<string>,
): Promise<void> {
  const mob = mobMap.get(step.objectId);
  if (!mob) return;
  const dur = step.duration;

  const ensureOnScene = (id: string) => {
    if (!onScene.has(id)) {
      scene.add(mobMap.get(id));
      onScene.add(id);
    }
  };

  try {
    switch (step.animationType) {
      case 'Create':
        ensureOnScene(step.objectId);
        await scene.play(new Create(mob, { duration: dur } as any));
        break;
      case 'FadeIn':
        ensureOnScene(step.objectId);
        await scene.play(new FadeIn(mob, { duration: dur } as any));
        break;
      case 'FadeOut':
        ensureOnScene(step.objectId);
        await scene.play(new FadeOut(mob, { duration: dur } as any));
        onScene.delete(step.objectId);
        break;
      case 'Write':
        ensureOnScene(step.objectId);
        await scene.play(new Write(mob, { duration: dur } as any));
        break;
      case 'GrowFromCenter':
        ensureOnScene(step.objectId);
        await scene.play(new GrowFromCenter(mob, { duration: dur } as any));
        break;
      case 'Indicate':
        ensureOnScene(step.objectId);
        await scene.play(new Indicate(mob, { duration: dur } as any));
        break;
      case 'Transform': {
        const tgtId = step.params?.targetObjectId;
        const tgt = tgtId ? mobMap.get(tgtId) : null;
        ensureOnScene(step.objectId);
        if (tgt) {
          ensureOnScene(tgtId!);
          await scene.play(new Transform(mob, tgt, { duration: dur } as any));
        } else {
          await scene.play(new Indicate(mob, { duration: dur } as any));
        }
        break;
      }
      case 'MoveTo': {
        const pos = step.params?.targetPosition ?? [0, 0, 0];
        ensureOnScene(step.objectId);
        try {
          if (mob.animate?.moveTo) {
            await scene.play(mob.animate.moveTo(pos) as any);
          } else {
            mob.moveTo?.(pos);
            await scene.wait(dur);
          }
        } catch {
          mob.moveTo?.(pos);
          await scene.wait(dur);
        }
        break;
      }
    }
  } catch (e) {
    console.error(`Step error [${step.animationType}]:`, e);
    await new Promise(r => setTimeout(r, dur * 1000));
  }
}

// ─── Exported handle ──────────────────────────────────────────────────────────

export interface CanvasHandle {
  playAll: () => Promise<void>;
  stopAll: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ManimCanvas = forwardRef<CanvasHandle>((_, ref) => {
  const dispatch = useDispatch<AppDispatch>();

  // Preview canvas (always visible during editing)
  const previewRef = useRef<HTMLCanvasElement>(null);
  // WebGL container (only used during playback)
  const webglRef = useRef<HTMLDivElement>(null);
  const playSceneRef = useRef<Scene | null>(null);
  const abortRef = useRef(false);
  const mountedRef = useRef(true);

  const objects = useSelector((s: RootState) => s.editor.objects);
  const selectedId = useSelector((s: RootState) => s.editor.selectedObjectId);
  const isPlaying = useSelector((s: RootState) => s.editor.isPlaying);
  const currentStep = useSelector((s: RootState) => s.editor.currentStep);
  const steps = useSelector((s: RootState) => s.editor.animationSteps);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try { (playSceneRef.current as any)?.dispose?.(); } catch { /* */ }
    };
  }, []);

  // ── LIVE PREVIEW: redraws synchronously on every state change ──────────────
  useEffect(() => {
    if (isPlaying) return; // don't overdraw during playback
    const canvas = previewRef.current;
    if (!canvas) return;
    renderPreviewFrame(canvas, objects, selectedId);
  }, [objects, selectedId, isPlaying]);

  // ── PLAYBACK ───────────────────────────────────────────────────────────────

  const playAll = useCallback(async () => {
    if (!webglRef.current) return;
    const sorted = [...steps].sort((a, b) => a.order - b.order);
    if (sorted.length === 0) return;

    // Dispose previous play scene
    try { (playSceneRef.current as any)?.dispose?.(); } catch { /* */ }

    const scene = new Scene(webglRef.current, {
      width: W, height: H, backgroundColor: BLACK,
    } as any);
    playSceneRef.current = scene;

    // Build fresh mobjects
    const mobMap = new Map<string, any>();
    for (const obj of objects.filter(o => o.visible)) {
      const mob = buildMobject(obj);
      applyPos(mob, obj.props.position);
      mobMap.set(obj.id, mob);
    }

    const onScene = new Set<string>();
    abortRef.current = false;
    dispatch(setIsPlaying(true));

    try {
      for (let i = 0; i < sorted.length; i++) {
        if (abortRef.current || !mountedRef.current) break;
        dispatch(setCurrentStep(i));
        await runStep(scene, sorted[i], mobMap, onScene);
      }
      if (mountedRef.current && !abortRef.current) {
        await scene.wait(0.3);
      }
    } catch (e) {
      console.error('Playback error:', e);
    } finally {
      if (mountedRef.current) {
        dispatch(stopPlayback());
        try { (playSceneRef.current as any)?.dispose?.(); } catch { /* */ }
        playSceneRef.current = null;
        // Redraw preview after playback ends
        if (previewRef.current) renderPreviewFrame(previewRef.current, objects, selectedId);
      }
    }
  }, [steps, objects, selectedId, dispatch]);

  const stopAll = useCallback(() => {
    abortRef.current = true;
    dispatch(stopPlayback());
    try { (playSceneRef.current as any)?.dispose?.(); } catch { /* */ }
    playSceneRef.current = null;
    if (previewRef.current) renderPreviewFrame(previewRef.current, objects, selectedId);
  }, [dispatch, objects, selectedId]);

  useImperativeHandle(ref, () => ({ playAll, stopAll }), [playAll, stopAll]);

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a14',
        cursor: 'default',
      }}
      onClick={e => { if (e.target === e.currentTarget) dispatch(selectObject(null)); }}
    >
      {/* ── Preview canvas (always mounted) ── */}
      <canvas
        ref={previewRef}
        width={W}
        height={H}
        style={{
          position: 'absolute',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 0 0 1px rgba(88,196,221,0.08), 0 20px 60px rgba(0,0,0,0.6)',
          // Hide during playback so WebGL is on top
          opacity: isPlaying ? 0 : 1,
          transition: 'opacity 0.2s',
          pointerEvents: isPlaying ? 'none' : 'auto',
        }}
        onClick={e => {
          if (!isPlaying) dispatch(selectObject(null));
        }}
      />

      {/* ── WebGL container (manim-web, playback only) ── */}
      <div
        ref={webglRef}
        style={{
          position: 'absolute',
          width: W, height: H,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 0 0 1px rgba(88,196,221,0.08), 0 20px 60px rgba(0,0,0,0.6)',
          opacity: isPlaying ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
          background: '#030712',
        }}
      />

      {/* ── Playback HUD ── */}
      {isPlaying && (
        <div style={{
          position: 'absolute',
          top: 'calc(50% - 256px)',
          left: 'calc(50% - 427px)',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 14px',
          background: 'rgba(131,193,103,0.12)',
          border: '1px solid rgba(131,193,103,0.35)',
          borderRadius: 20,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', display: 'block',
            background: '#83C167', animation: 'mw-pulse 1s infinite',
          }} />
          <span style={{ fontSize: 11, color: '#83C167', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>
            STEP {currentStep + 1} / {steps.length}
          </span>
        </div>
      )}

      {/* ── Dimension label ── */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(50% - 252px)',
        left: 'calc(50% - 427px)',
        fontSize: 9, color: 'rgba(255,255,255,0.1)', fontFamily: 'monospace',
      }}>
        854 × 480
      </div>

      {/* ── Empty state ── */}
      {objects.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 12, color: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
            <rect x="7" y="7" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
            <polygon points="44,7 55,26 33,26" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
          </svg>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            Add objects from the layers panel
          </span>
        </div>
      )}
    </div>
  );
});

ManimCanvas.displayName = 'ManimCanvas';
export default ManimCanvas;
