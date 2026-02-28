import { useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  addAnimationStep, deleteAnimationStep, selectStep, updateAnimationStep,
} from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { AnimationType } from '../../types/scene';
import type { CanvasHandle } from '../canvas/ManimCanvas';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANIM_TYPES: AnimationType[] = [
  'Create', 'FadeIn', 'FadeOut', 'Write', 'GrowFromCenter', 'Transform', 'Indicate', 'MoveTo',
];

const ANIM_COLOR: Record<AnimationType, string> = {
  Create: '#58C4DD', FadeIn: '#83C167', FadeOut: '#FC6255',
  Write: '#FFDD55', GrowFromCenter: '#C77DBB',
  Transform: '#FF8C42', Indicate: '#FFD166', MoveTo: '#06D6A0',
};

const PX_PER_S = 80;   // pixels per second on ruler
const ROW_H = 34;      // track row height
const LABEL_W = 128;   // left label column width

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { canvasRef: React.RefObject<CanvasHandle | null>; }

export default function TimelinePanel({ canvasRef }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const objects    = useSelector((s: RootState) => s.editor.objects);
  const steps      = useSelector((s: RootState) => s.editor.animationSteps);
  const selObjId   = useSelector((s: RootState) => s.editor.selectedObjectId);
  const selStepId  = useSelector((s: RootState) => s.editor.selectedStepId);
  const isPlaying  = useSelector((s: RootState) => s.editor.isPlaying);
  const curStep    = useSelector((s: RootState) => s.editor.currentStep);

  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const totalDur = sorted.reduce((s, x) => s + x.duration, 0);

  // Start times per step id
  const startOf = new Map<string, number>();
  let cursor = 0;
  for (const s of sorted) { startOf.set(s.id, cursor); cursor += s.duration; }

  const byObj = objects.map(obj => ({ obj, steps: sorted.filter(s => s.objectId === obj.id) }));
  const selStep = steps.find(s => s.id === selStepId);
  const activeObjId = selObjId ?? objects[0]?.id;

  const trackW = Math.max(totalDur * PX_PER_S + 160, 600);

  const handlePlay = () => {
    if (isPlaying) canvasRef.current?.stopAll();
    else canvasRef.current?.playAll();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#0d0d18', borderTop: '1px solid #1e1e2e', flexShrink: 0, height: 220 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, borderBottom: '1px solid #1e1e2e', background: '#0a0a14', flexShrink: 0 }}>

        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: '#3a3a55', textTransform: 'uppercase', fontFamily: 'monospace', marginRight: 4 }}>
          Timeline
        </span>

        {/* Reset */}
        <Btn title="Reset" onClick={() => canvasRef.current?.stopAll()} disabled={!isPlaying}>
          ⏮
        </Btn>

        {/* Play/Stop */}
        <button
          onClick={handlePlay}
          disabled={sorted.length === 0}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, border: 'none', cursor: sorted.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace', fontSize: 13, transition: 'all 0.15s',
            background: isPlaying ? 'rgba(252,98,85,0.2)' : 'rgba(131,193,103,0.2)',
            color: isPlaying ? '#FC6255' : '#83C167',
          }}
          title={isPlaying ? 'Stop' : 'Play All'}
        >
          {isPlaying ? '■' : '▶'}
        </button>

        <span style={{ fontSize: 10, color: '#3a3a55', fontFamily: 'monospace', minWidth: 90 }}>
          {isPlaying ? `step ${curStep + 1}/${sorted.length}` : `${sorted.length} steps · ${totalDur.toFixed(1)}s`}
        </span>

        <div style={{ flex: 1 }} />

        {/* Add animation to selected object */}
        {activeObjId && (
          <>
            <span style={{ fontSize: 10, color: '#3a3a55', fontFamily: 'monospace' }}>Add to:</span>
            <select
              disabled={isPlaying}
              defaultValue=""
              onChange={e => {
                if (!e.target.value) return;
                dispatch(addAnimationStep({ objectId: activeObjId, animationType: e.target.value as AnimationType }));
                e.target.value = '';
              }}
              style={selectStyle}
            >
              <option value="" disabled>+ Animation</option>
              {ANIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ── Track area ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Object labels */}
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column' }}>
          {/* Ruler gap */}
          <div style={{ height: 18, borderBottom: '1px solid #1a1a28', background: '#080812' }} />

          {byObj.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 10, color: '#222234', fontFamily: 'monospace' }}>No objects</div>
          )}
          {byObj.map(({ obj }) => (
            <div
              key={obj.id}
              onClick={() => dispatch({ type: 'editor/selectObject', payload: obj.id })}
              style={{
                height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 10px',
                borderBottom: '1px solid #12121e', cursor: 'pointer',
                background: obj.id === selObjId ? 'rgba(88,196,221,0.05)' : 'transparent',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 10, color: obj.props.color, flexShrink: 0 }}>◉</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: obj.visible ? '#7070a0' : '#2a2a40', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {obj.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable tracks */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
          <div style={{ width: trackW, position: 'relative' }}>

            {/* Ruler */}
            <div style={{ height: 18, background: '#080812', borderBottom: '1px solid #1a1a28', position: 'relative' }}>
              {Array.from({ length: Math.ceil(totalDur) + 3 }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i * PX_PER_S, top: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, width: 1, height: '100%', background: '#1e1e30' }} />
                  <span style={{ fontSize: 8, color: '#333355', fontFamily: 'monospace', paddingLeft: 3 }}>{i}s</span>
                </div>
              ))}
              {/* Playhead */}
              {isPlaying && curStep >= 0 && sorted[curStep] && (
                <div style={{
                  position: 'absolute', left: (startOf.get(sorted[curStep].id) ?? 0) * PX_PER_S,
                  top: 0, width: 1, height: 999, background: 'rgba(131,193,103,0.6)', zIndex: 10, pointerEvents: 'none',
                }} />
              )}
            </div>

            {/* Object tracks */}
            {byObj.map(({ obj, steps: objSteps }) => (
              <div key={obj.id} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid #10101c' }}>
                {/* Grid */}
                {Array.from({ length: Math.ceil(totalDur) + 3 }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', left: i * PX_PER_S, top: 0, width: 1, height: '100%', background: '#13131e' }} />
                ))}

                {/* Step blocks */}
                {objSteps.map(step => {
                  const x = (startOf.get(step.id) ?? 0) * PX_PER_S;
                  const w = Math.max(step.duration * PX_PER_S - 3, 28);
                  const color = ANIM_COLOR[step.animationType] ?? '#888';
                  const isSel = step.id === selStepId;
                  const isActive = isPlaying && sorted[curStep]?.id === step.id;
                  return (
                    <div
                      key={step.id}
                      onClick={() => dispatch(selectStep(step.id))}
                      title={`${step.animationType} · ${step.duration}s`}
                      style={{
                        position: 'absolute', left: x, top: 4, width: w, height: ROW_H - 8,
                        borderRadius: 4, cursor: 'pointer',
                        background: isSel ? `${color}25` : `${color}12`,
                        border: isSel ? `1px solid ${color}70` : `1px solid ${color}25`,
                        borderLeft: `3px solid ${color}`,
                        display: 'flex', alignItems: 'center', padding: '0 5px', overflow: 'hidden',
                        boxShadow: isActive ? `0 0 10px ${color}40` : 'none',
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                        {step.animationType.slice(0, 7)}
                      </span>
                      <span style={{ fontSize: 8, color: `${color}70`, marginLeft: 4, fontFamily: 'monospace' }}>{step.duration}s</span>
                      <button
                        onClick={e => { e.stopPropagation(); dispatch(deleteAnimationStep(step.id)); }}
                        style={{ marginLeft: 'auto', fontSize: 8, color: `${color}60`, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Selected step inspector ── */}
      {selStep && (() => {
        const stepObj = objects.find(o => o.id === selStep.objectId);
        const color = ANIM_COLOR[selStep.animationType] ?? '#888';
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px',
            height: 32, borderTop: '1px solid #1e1e2e', background: '#080812',
            flexShrink: 0, fontFamily: 'monospace', fontSize: 10,
          }}>
            <span style={{ color: '#5050a0' }}>
              <span style={{ color: '#8080c0' }}>{stepObj?.label}</span>
              <span style={{ margin: '0 6px', color: '#2a2a40' }}>→</span>
              <span style={{ color }}>{selStep.animationType}</span>
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4a4a70' }}>
              Duration
              <input type="number" min={0.1} max={20} step={0.1} value={selStep.duration}
                onChange={e => dispatch(updateAnimationStep({ id: selStep.id, changes: { duration: Math.max(0.1, parseFloat(e.target.value) || 1) } }))}
                style={numInputStyle} />
              s
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4a4a70' }}>
              Type
              <select value={selStep.animationType}
                onChange={e => dispatch(updateAnimationStep({ id: selStep.id, changes: { animationType: e.target.value as AnimationType } }))}
                style={selectStyle}>
                {ANIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            {selStep.animationType === 'Transform' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4a4a70' }}>
                Target
                <select value={selStep.params?.targetObjectId ?? ''}
                  onChange={e => dispatch(updateAnimationStep({ id: selStep.id, changes: { params: { ...selStep.params, targetObjectId: e.target.value } } }))}
                  style={selectStyle}>
                  <option value="">— none —</option>
                  {objects.filter(o => o.id !== selStep.objectId).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}

            {selStep.animationType === 'MoveTo' && (['X', 'Y', 'Z'] as const).map((axis, i) => (
              <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4a4a70' }}>
                {axis}
                <input type="number" step={0.5}
                  value={selStep.params?.targetPosition?.[i] ?? 0}
                  onChange={e => {
                    const pos: [number, number, number] = [...(selStep.params?.targetPosition ?? [0, 0, 0])] as [number, number, number];
                    pos[i] = parseFloat(e.target.value) || 0;
                    dispatch(updateAnimationStep({ id: selStep.id, changes: { params: { ...selStep.params, targetPosition: pos } } }));
                  }}
                  style={{ ...numInputStyle, width: 42 }} />
              </label>
            ))}

            <div style={{ flex: 1 }} />
            <button onClick={() => dispatch(deleteAnimationStep(selStep.id))}
              style={{ fontSize: 10, color: '#6a3333', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              Delete
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ── Micro styles ──────────────────────────────────────────────────────────────

function Btn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 5, border: '1px solid #1e1e2e', background: 'none',
      color: disabled ? '#1e1e2e' : '#4a4a70', cursor: disabled ? 'default' : 'pointer',
      fontSize: 11, fontFamily: 'monospace',
    }}>
      {children}
    </button>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: 'monospace',
  background: '#0d0d1a', border: '1px solid #1e1e2e',
  color: '#8080c0', borderRadius: 4, padding: '2px 6px',
  cursor: 'pointer', outline: 'none',
};

const numInputStyle: React.CSSProperties = {
  width: 48, fontSize: 10, fontFamily: 'monospace',
  background: '#0d0d1a', border: '1px solid #1e1e2e',
  color: '#8080c0', borderRadius: 4, padding: '2px 5px', outline: 'none',
};
