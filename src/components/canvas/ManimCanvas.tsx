import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectObject, setIsPlaying, setCurrentStep, stopPlayback, dragObjectPosition, startDrag } from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import { CANVAS_W, CANVAS_H, SCALE, buildMobject, createScene, disposeScene, runStep } from '../../engine/ManimAdapter';
import { renderPreviewFrame, hitTestObject, getHandlePositions } from '../../engine/SceneRenderer';

export interface CanvasHandle {
  playAll: () => Promise<void>;
  stopAll: () => void;
  seekPreview: (time: number) => void;
}

interface DragState { objectId: string; startMouseX: number; startMouseY: number; startObjX: number; startObjY: number; startObjZ: number; }

const ManimCanvas = forwardRef<CanvasHandle>((_, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const objects   = useSelector((s: RootState) => s.editor.present.objects);
  const steps     = useSelector((s: RootState) => s.editor.present.animationSteps);
  const selectedId= useSelector((s: RootState) => s.editor.selectedObjectId);
  const isPlaying = useSelector((s: RootState) => s.editor.isPlaying);

  const previewRef    = useRef<HTMLCanvasElement>(null);
  const webglRef      = useRef<HTMLDivElement>(null);
  const playSceneRef  = useRef<any>(null);
  const abortRef      = useRef(false);
  const mountedRef    = useRef(false);
  const playbackRateRef = useRef(1);
  const dragRef       = useRef<DragState | null>(null);

  const [previewTime, setPreviewTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const sortedSteps = [...steps].sort((a, b) => a.startTime - b.startTime);
  const totalDuration = sortedSteps.length > 0 ? Math.max(...sortedSteps.map(s => s.startTime + s.duration)) : 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; disposeScene(playSceneRef.current); };
  }, []);

  useEffect(() => {
    if (isPlaying) return;
    if (previewRef.current) renderPreviewFrame(previewRef.current, objects, steps, selectedId, previewTime);
  }, [objects, selectedId, isPlaying, steps, previewTime]);

  const seekPreview = useCallback((time: number) => {
    setPreviewTime(Math.max(0, Math.min(time, totalDuration)));
  }, [totalDuration]);

  const getCursorPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = previewRef.current!;
    const rect = c.getBoundingClientRect();
    return { cx: (e.clientX - rect.left) * CANVAS_W / rect.width, cy: (e.clientY - rect.top) * CANVAS_H / rect.height };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;
    const { cx, cy } = getCursorPos(e);
    const visible = [...objects].filter(o => o.visible && !o.locked).reverse();
    for (const obj of visible) {
      if (hitTestObject(obj, cx, cy)) {
        dispatch(selectObject(obj.id));
        dispatch(startDrag(obj.id));
        dragRef.current = { objectId: obj.id, startMouseX: cx, startMouseY: cy, startObjX: obj.props.position[0], startObjY: obj.props.position[1], startObjZ: obj.props.position[2] };
        return;
      }
    }
    dispatch(selectObject(null));
  }, [isPlaying, objects, dispatch]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || isPlaying) return;
    const { cx, cy } = getCursorPos(e);
    const d = dragRef.current;
    const dx = (cx - d.startMouseX) / SCALE;
    const dy = -(cy - d.startMouseY) / SCALE;
    const snap = 0.05;
    const nx = Math.round((d.startObjX + dx) / snap) * snap;
    const ny = Math.round((d.startObjY + dy) / snap) * snap;
    dispatch(dragObjectPosition({ id: d.objectId, position: [nx, ny, d.startObjZ] }));
  }, [isPlaying, dispatch]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const playAll = useCallback(async () => {
    if (!webglRef.current || sortedSteps.length === 0) return;
    disposeScene(playSceneRef.current);
    const scene = createScene(webglRef.current);
    playSceneRef.current = scene;
    const mobMap = new Map<string, any>();
    for (const obj of objects.filter(o => o.visible)) mobMap.set(obj.id, buildMobject(obj));
    const onScene = new Set<string>();
    abortRef.current = false;
    dispatch(setIsPlaying(true));
    setCurrentTime(0);
    let elapsed = 0, last = performance.now(), rafId = 0;
    const tick = (now: number) => {
      if (abortRef.current) return;
      elapsed += (now - last) / 1000 * playbackRateRef.current;
      last = now;
      setCurrentTime(Math.min(elapsed, totalDuration));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    try {
      for (let i = 0; i < sortedSteps.length; i++) {
        if (abortRef.current || !mountedRef.current) break;
        const step = sortedSteps[i];
        if (elapsed < step.startTime) {
          const wait = step.startTime - elapsed;
          await scene.wait(wait);
          elapsed = step.startTime;
        }
        dispatch(setCurrentStep(i));
        await runStep(scene, step, mobMap, onScene);
      }
      if (mountedRef.current && !abortRef.current) await scene.wait(0.3);
    } catch(e) { console.error('Playback error:', e); }
    finally {
      cancelAnimationFrame(rafId);
      if (mountedRef.current) {
        dispatch(stopPlayback());
        disposeScene(playSceneRef.current);
        playSceneRef.current = null;
        setCurrentTime(0);
        if (previewRef.current) renderPreviewFrame(previewRef.current, objects, steps, selectedId, previewTime);
      }
    }
  }, [sortedSteps, objects, selectedId, dispatch, totalDuration, previewTime, steps]);

  const stopAll = useCallback(() => {
    abortRef.current = true;
    dispatch(stopPlayback());
    disposeScene(playSceneRef.current);
    playSceneRef.current = null;
    setCurrentTime(0);
    if (previewRef.current) renderPreviewFrame(previewRef.current, objects, steps, selectedId, previewTime);
  }, [dispatch, objects, selectedId, steps, previewTime]);

  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useImperativeHandle(ref, () => ({ playAll, stopAll, seekPreview }), [playAll, stopAll, seekPreview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); isPlaying ? stopAll() : playAll(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, playAll, stopAll]);

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#030712', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div ref={webglRef} style={{ position:'absolute', inset:0, opacity:isPlaying?1:0, pointerEvents:'none', transition:'opacity 0.15s' }} />
      <canvas
        ref={previewRef} width={CANVAS_W} height={CANVAS_H}
        style={{ display:'block', maxWidth:'100%', maxHeight:'100%', objectFit:'contain', cursor:dragRef.current?'grabbing':'crosshair', opacity:isPlaying?0:1, transition:'opacity 0.15s' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      />
      {isPlaying && (
        <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:8, background:'rgba(5,5,18,0.88)', backdropFilter:'blur(8px)', borderRadius:8, padding:'6px 14px', border:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={stopAll} style={{ padding:'4px 10px', borderRadius:5, fontSize:10, fontFamily:'monospace', background:'rgba(252,98,85,0.2)', border:'1px solid rgba(252,98,85,0.3)', color:'#FC6255', cursor:'pointer' }}>■ Stop</button>
          <span style={{ fontSize:10, color:'#5050a0', fontFamily:'monospace' }}>{currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s</span>
          {[0.5, 1, 2].map(r => (
            <button key={r} onClick={() => { setPlaybackRate(r); playbackRateRef.current = r; }} style={{ padding:'2px 6px', borderRadius:3, fontSize:9, fontFamily:'monospace', background:playbackRate===r?'rgba(88,196,221,0.2)':'transparent', border:`1px solid ${playbackRate===r?'#58C4DD':'rgba(255,255,255,0.1)'}`, color:playbackRate===r?'#58C4DD':'#4a4a70', cursor:'pointer' }}>{r}x</button>
          ))}
        </div>
      )}
      {isPlaying && totalDuration > 0 && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.04)' }}>
          <div style={{ height:'100%', width:`${(currentTime/totalDuration)*100}%`, background:'linear-gradient(90deg,#58C4DD,#6060ee)', transition:'width 0.1s linear' }} />
        </div>
      )}
    </div>
  );
});

ManimCanvas.displayName = 'ManimCanvas';
export default ManimCanvas;
