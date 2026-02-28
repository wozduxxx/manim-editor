import { useRef } from 'react';
import { Provider, useSelector } from 'react-redux';
import { store } from './store/editorStore';
import ManimCanvas, { type CanvasHandle } from './components/canvas/ManimCanvas';
import PropertiesPanel from './components/panel/PropertiesPanel';
import ObjectsPanel from './components/panel/ObjectsPanel';
import TimelinePanel from './components/timeline/TimelinePanel';
import { downloadPython } from './utils/pythonExporter';
import type { RootState } from './store/editorStore';

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ canvasRef }: { canvasRef: React.RefObject<CanvasHandle | null> }) {
  const objects   = useSelector((s: RootState) => s.editor.objects);
  const steps     = useSelector((s: RootState) => s.editor.animationSteps);
  const isPlaying = useSelector((s: RootState) => s.editor.isPlaying);
  const sorted    = [...steps].sort((a, b) => a.order - b.order);

  return (
    <header style={{
      height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
      background: '#090912', borderBottom: '1px solid #1a1a28',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #58C4DD 0%, #6060ee 100%)',
          boxShadow: '0 0 14px rgba(88,196,221,0.3)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1 }}>M</span>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d0d0f0', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Manim Editor</div>
          <div style={{ fontSize: 8, color: '#333355', fontFamily: 'monospace', letterSpacing: '0.05em' }}>VISUAL STUDIO</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: '#1e1e2e' }} />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Stat label="Objects" value={objects.length} />
        <Stat label="Animations" value={steps.length} />
        {steps.length > 0 && (
          <Stat label="Duration" value={`${sorted.reduce((s, x) => s + x.duration, 0).toFixed(1)}s`} />
        )}
      </div>

      {isPlaying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#83C167', display: 'block', animation: 'mw-pulse 1s infinite' }} />
          <span style={{ fontSize: 10, color: '#83C167', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>PLAYING</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Play shortcut in toolbar */}
      <button
        onClick={() => isPlaying ? canvasRef.current?.stopAll() : canvasRef.current?.playAll()}
        disabled={sorted.length === 0}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          borderRadius: 7, border: 'none', cursor: sorted.length === 0 ? 'not-allowed' : 'pointer',
          fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
          background: isPlaying ? 'rgba(252,98,85,0.2)' : 'rgba(131,193,103,0.15)',
          color: isPlaying ? '#FC6255' : (sorted.length === 0 ? '#2a3a2a' : '#83C167'),
          border: `1px solid ${isPlaying ? 'rgba(252,98,85,0.3)' : 'rgba(131,193,103,0.2)'}`,
          transition: 'all 0.15s',
        }}
      >
        {isPlaying ? '■ Stop' : '▶ Play All'}
      </button>

      <button
        onClick={() => downloadPython(objects, steps)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          borderRadius: 7, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
          background: 'transparent', border: '1px solid #1e1e2e',
          color: '#4a6a5a', cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = '#2a4a3a'; e.currentTarget.style.color = '#83C167'; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = '#1e1e2e'; e.currentTarget.style.color = '#4a6a5a'; }}
      >
        🐍 Export .py
      </button>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
      <span style={{ fontSize: 9, color: '#2a2a40', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#5050a0', fontFamily: 'monospace', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor() {
  const canvasRef = useRef<CanvasHandle>(null);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d0d1a', color: '#e0e0f0', overflow: 'hidden' }}>
      <Toolbar canvasRef={canvasRef} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Layers */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <ObjectsPanel />
        </div>

        {/* Center: Canvas + Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ManimCanvas ref={canvasRef} />
          </div>
          <TimelinePanel canvasRef={canvasRef} />
        </div>

        {/* Right: Properties */}
        <div style={{ width: 230, flexShrink: 0 }}>
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Provider store={store}>
      <Editor />
    </Provider>
  );
}
