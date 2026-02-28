import { useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  addAnimationStep,
  deleteAnimationStep,
  selectStep,
  updateAnimationStep,
  // resetPlayback,
} from '../../store/editorStore';
import { downloadPython } from '../../utils/pythonExporter';
import { useSceneController } from '../../controllers/SceneController';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { AnimationType } from '../../types/scene';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANIM_TYPES: AnimationType[] = [
  'Create', 'FadeIn', 'FadeOut', 'Write', 'GrowFromCenter', 'Transform', 'Indicate', 'MoveTo',
];

const ANIM_COLOR: Record<AnimationType, string> = {
  Create:         '#58C4DD',
  FadeIn:         '#83C167',
  FadeOut:        '#FC6255',
  Write:          '#FFDD55',
  GrowFromCenter: '#C77DBB',
  Transform:      '#FF8C42',
  Indicate:       '#FFD166',
  MoveTo:         '#06D6A0',
};

const ANIM_SHORT: Record<AnimationType, string> = {
  Create:         'Create',
  FadeIn:         'FadeIn',
  FadeOut:        'FadeOut',
  Write:          'Write',
  GrowFromCenter: 'Grow',
  Transform:      'Transform',
  Indicate:       'Indicate',
  MoveTo:         'MoveTo',
};

// px per second on the ruler
const PX_PER_S = 72;
const ROW_H = 36;
const LABEL_W = 120;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayButton({ onClick, isPlaying }: { onClick: () => void; isPlaying: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded transition-all"
      style={{
        width: 28, height: 28,
        background: isPlaying ? 'rgba(252,98,85,0.15)' : 'rgba(131,193,103,0.15)',
        border: `1px solid ${isPlaying ? 'rgba(252,98,85,0.4)' : 'rgba(131,193,103,0.4)'}`,
        color: isPlaying ? '#FC6255' : '#83C167',
        fontSize: 13,
        cursor: 'pointer',
      }}
      title={isPlaying ? 'Stop' : 'Play All'}
    >
      {isPlaying ? '⏹' : '▶'}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimelinePanel() {
  const dispatch = useDispatch<AppDispatch>();
  const controller = useSceneController();
  const scrollRef = useRef<HTMLDivElement>(null);

  const objects     = useSelector((s: RootState) => s.editor.objects);
  const steps       = useSelector((s: RootState) => s.editor.animationSteps);
  const selectedId  = useSelector((s: RootState) => s.editor.selectedObjectId);
  const selectedStepId = useSelector((s: RootState) => s.editor.selectedStepId);
  const isPlaying   = useSelector((s: RootState) => s.editor.isPlaying);
  const currentStep = useSelector((s: RootState) => s.editor.currentStep);

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  const totalDuration = sortedSteps.reduce((s, x) => s + x.duration, 0);

  // Cumulative start times per step id
  const startTimes = new Map<string, number>();
  let cursor = 0;
  for (const s of sortedSteps) {
    startTimes.set(s.id, cursor);
    cursor += s.duration;
  }

  // Group steps by object
  const byObject = objects.map((obj) => ({
    obj,
    steps: sortedSteps.filter((s) => s.objectId === obj.id),
  }));

  // ── Playback ──────────────────────────────────────────────────────────────

  const handlePlay = () => {
    if (isPlaying) {
      controller.stop();
    } else {
      controller.playAll(sortedSteps, objects);
    }
  };

  const handleReset = () => {
    controller.stop();
    // dispatch(resetPlayback());
  };

  // ── Ruler ticks ───────────────────────────────────────────────────────────

  const rulerTicks = Math.ceil(totalDuration) + 2;

  // ── The currently-selected step ───────────────────────────────────────────

  const selStep = steps.find((s) => s.id === selectedStepId);

  return (
    <div
      className="flex flex-col flex-shrink-0 border-t"
      style={{
        height: 220,
        background: '#0a0a1e',
        borderColor: 'rgba(42,42,74,0.8)',
      }}
    >
      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: 36,
          borderBottom: '1px solid rgba(42,42,74,0.8)',
          background: 'rgba(10,10,30,0.6)',
        }}
      >
        {/* Label */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'rgba(130,130,180,0.6)',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
            marginRight: 4,
          }}
        >
          Timeline
        </span>

        {/* Playback controls */}
        <button
          onClick={handleReset}
          title="Reset"
          className="flex items-center justify-center rounded transition-all"
          style={{
            width: 24, height: 24,
            background: 'transparent',
            border: '1px solid rgba(42,42,74,0.5)',
            color: 'rgba(120,120,170,0.7)',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          ⏮
        </button>

        <PlayButton onClick={handlePlay} isPlaying={isPlaying} />

        <span
          style={{
            fontSize: 10,
            color: 'rgba(100,100,150,0.7)',
            fontFamily: 'monospace',
            minWidth: 80,
          }}
        >
          {isPlaying
            ? `▶ ${currentStep + 1}/${sortedSteps.length}`
            : `${sortedSteps.length} steps · ${totalDuration.toFixed(1)}s`}
        </span>

        <div style={{ flex: 1 }} />

        {/* Add animation to selected object */}
        {(selectedId || objects.length > 0) && (
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 10, color: 'rgba(100,100,150,0.6)' }}>Add:</span>
            <select
              disabled={isPlaying}
              defaultValue=""
              onChange={(e) => {
                const targetId = selectedId ?? objects[0]?.id;
                if (!e.target.value || !targetId) return;
                dispatch(addAnimationStep({
                  objectId: targetId,
                  animationType: e.target.value as AnimationType,
                }));
                e.target.value = '';
              }}
              style={{
                fontSize: 10,
                background: 'rgba(20,20,50,0.8)',
                border: '1px solid rgba(42,42,74,0.8)',
                color: 'rgba(180,180,220,0.9)',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="" disabled>+ Animation</option>
              {ANIM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        {/* Export */}
        <button
          onClick={() => downloadPython(objects, steps)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px',
            borderRadius: 5,
            fontSize: 10, fontWeight: 700,
            background: 'rgba(26,58,42,0.8)',
            border: '1px solid rgba(42,90,60,0.8)',
            color: '#83C167',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          🐍 Export .py
        </button>
      </div>

      {/* ── Track area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Object labels column */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: LABEL_W,
            borderRight: '1px solid rgba(42,42,74,0.6)',
          }}
        >
          {/* Ruler placeholder */}
          <div style={{ height: 18, borderBottom: '1px solid rgba(42,42,74,0.4)' }} />

          {byObject.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 10, color: 'rgba(60,60,100,0.7)' }}>
              No objects
            </div>
          )}

          {byObject.map(({ obj }) => (
            <div
              key={obj.id}
              onClick={() => dispatch({ type: 'editor/selectObject', payload: obj.id })}
              className="flex items-center px-3 cursor-pointer"
              style={{
                height: ROW_H,
                borderBottom: '1px solid rgba(20,20,50,0.8)',
                background:
                  obj.id === selectedId ? 'rgba(40,40,80,0.6)' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <span
                className="truncate"
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: obj.visible ? 'rgba(180,180,220,0.9)' : 'rgba(80,80,120,0.6)',
                  letterSpacing: '0.03em',
                }}
              >
                {obj.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable track content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div style={{ minWidth: Math.max(totalDuration * PX_PER_S + 120, 400), position: 'relative' }}>

            {/* Time ruler */}
            <div
              className="relative"
              style={{
                height: 18,
                borderBottom: '1px solid rgba(42,42,74,0.4)',
                background: 'rgba(5,5,20,0.6)',
              }}
            >
              {Array.from({ length: rulerTicks }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: i * PX_PER_S,
                    top: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 3,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 1,
                      height: '100%',
                      background: 'rgba(60,60,120,0.4)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 8,
                      color: 'rgba(90,90,140,0.7)',
                      fontFamily: 'monospace',
                      paddingLeft: 3,
                    }}
                  >
                    {i}s
                  </span>
                </div>
              ))}

              {/* Playhead */}
              {isPlaying && currentStep >= 0 && sortedSteps[currentStep] && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: (startTimes.get(sortedSteps[currentStep].id) ?? 0) * PX_PER_S,
                    width: 1,
                    height: '100vh',
                    background: 'rgba(131,193,103,0.5)',
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            {/* Tracks */}
            {byObject.map(({ obj, steps: objSteps }) => (
              <div
                key={obj.id}
                style={{
                  position: 'relative',
                  height: ROW_H,
                  borderBottom: '1px solid rgba(15,15,40,0.8)',
                }}
              >
                {/* Track grid lines */}
                {Array.from({ length: rulerTicks }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * PX_PER_S,
                      top: 0,
                      width: 1,
                      height: '100%',
                      background: 'rgba(40,40,90,0.25)',
                    }}
                  />
                ))}

                {/* Step blocks */}
                {objSteps.map((step) => {
                  const x = (startTimes.get(step.id) ?? 0) * PX_PER_S;
                  const w = Math.max(step.duration * PX_PER_S - 3, 32);
                  const color = ANIM_COLOR[step.animationType] ?? '#888';
                  const isSelected = step.id === selectedStepId;
                  const isActive = isPlaying && sortedSteps[currentStep]?.id === step.id;

                  return (
                    <div
                      key={step.id}
                      onClick={() => dispatch(selectStep(step.id))}
                      className="group"
                      style={{
                        position: 'absolute',
                        left: x,
                        top: 4,
                        width: w,
                        height: ROW_H - 8,
                        borderRadius: 5,
                        background: isSelected
                          ? `${color}28`
                          : isActive
                          ? `${color}20`
                          : `${color}12`,
                        borderLeft: `3px solid ${color}`,
                        border: isSelected
                          ? `1px solid ${color}80`
                          : `1px solid ${color}30`,
                        borderLeftWidth: 3,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 6px',
                        overflow: 'hidden',
                        transition: 'background 0.1s',
                        boxShadow: isActive ? `0 0 8px ${color}40` : 'none',
                        animation: isActive ? 'shimmer 1s ease-in-out infinite' : 'none',
                      }}
                      title={`${step.animationType} · ${step.duration}s`}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color,
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {ANIM_SHORT[step.animationType]}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          color: `${color}80`,
                          marginLeft: 4,
                          fontFamily: 'monospace',
                        }}
                      >
                        {step.duration}s
                      </span>
                      {/* Delete on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(deleteAnimationStep(step.id));
                        }}
                        className="opacity-0 group-hover:opacity-100"
                        style={{
                          marginLeft: 'auto',
                          fontSize: 8,
                          color: `${color}99`,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          lineHeight: 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Selected step editor ── */}
      {selStep && (() => {
        const stepObj = objects.find((o) => o.id === selStep.objectId);
        return (
          <div
            className="flex items-center gap-4 px-3 flex-shrink-0"
            style={{
              height: 32,
              borderTop: '1px solid rgba(42,42,74,0.6)',
              background: 'rgba(8,8,24,0.8)',
              fontSize: 10,
              color: 'rgba(140,140,190,0.8)',
              fontFamily: 'monospace',
            }}
          >
            <span>
              <span style={{ color: 'rgba(180,180,230,0.9)' }}>{stepObj?.label}</span>
              <span style={{ margin: '0 4px', color: 'rgba(80,80,120,0.6)' }}>→</span>
              <span style={{ color: ANIM_COLOR[selStep.animationType] ?? '#888' }}>
                {selStep.animationType}
              </span>
            </span>

            <label className="flex items-center gap-1.5">
              Duration:
              <input
                type="number"
                min={0.1}
                max={20}
                step={0.1}
                value={selStep.duration}
                onChange={(e) =>
                  dispatch(updateAnimationStep({
                    id: selStep.id,
                    changes: { duration: Math.max(0.1, parseFloat(e.target.value) || 1) },
                  }))
                }
                style={{
                  width: 52,
                  background: 'rgba(20,20,50,0.8)',
                  border: '1px solid rgba(42,42,74,0.8)',
                  color: 'rgba(200,200,240,0.9)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <span style={{ color: 'rgba(80,80,120,0.7)' }}>s</span>
            </label>

            <label className="flex items-center gap-1.5">
              Type:
              <select
                value={selStep.animationType}
                onChange={(e) =>
                  dispatch(updateAnimationStep({
                    id: selStep.id,
                    changes: { animationType: e.target.value as AnimationType },
                  }))
                }
                style={{
                  background: 'rgba(20,20,50,0.8)',
                  border: '1px solid rgba(42,42,74,0.8)',
                  color: 'rgba(200,200,240,0.9)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {ANIM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            {selStep.animationType === 'Transform' && (
              <label className="flex items-center gap-1.5">
                Target:
                <select
                  value={selStep.params?.targetObjectId ?? ''}
                  onChange={(e) =>
                    dispatch(updateAnimationStep({
                      id: selStep.id,
                      changes: { params: { ...selStep.params, targetObjectId: e.target.value } },
                    }))
                  }
                  style={{
                    background: 'rgba(20,20,50,0.8)',
                    border: '1px solid rgba(42,42,74,0.8)',
                    color: 'rgba(200,200,240,0.9)',
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">— select —</option>
                  {objects
                    .filter((o) => o.id !== selStep.objectId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                </select>
              </label>
            )}

            {selStep.animationType === 'MoveTo' && (
              <>
                {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                  <label key={axis} className="flex items-center gap-1">
                    {axis}:
                    <input
                      type="number"
                      step={0.5}
                      value={selStep.params?.targetPosition?.[i] ?? 0}
                      onChange={(e) => {
                        const pos: [number, number, number] = [
                          ...(selStep.params?.targetPosition ?? [0, 0, 0]) as [number, number, number]
                        ];
                        pos[i] = parseFloat(e.target.value) || 0;
                        dispatch(updateAnimationStep({
                          id: selStep.id,
                          changes: { params: { ...selStep.params, targetPosition: pos } },
                        }));
                      }}
                      style={{
                        width: 44,
                        background: 'rgba(20,20,50,0.8)',
                        border: '1px solid rgba(42,42,74,0.8)',
                        color: 'rgba(200,200,240,0.9)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        outline: 'none',
                      }}
                    />
                  </label>
                ))}
              </>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={() => dispatch(deleteAnimationStep(selStep.id))}
              style={{
                fontSize: 10,
                color: 'rgba(200,80,80,0.7)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              Delete
            </button>
          </div>
        );
      })()}
    </div>
  );
}
