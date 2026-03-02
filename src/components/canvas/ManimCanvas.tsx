/**
 * ManimCanvas — двухслойный canvas с полным PlayerUI
 *
 * LAYER 1: Canvas 2D — мгновенный превью (edit mode)
 *   - Перерисовывается при любом изменении Redux
 *   - seekPreview(time) → интерполирует объекты по времени
 *
 * LAYER 2: manim-web Scene (playback mode)
 *   - PlayerUI overlay: прогресс, seek, сегменты, speed, fullscreen
 *   - Keyboard: Space/k, ←/→, Shift+←/→, F, Home/End
 */

import {
  useEffect, useRef, useCallback, useState,
  forwardRef, useImperativeHandle,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectObject, setIsPlaying, setCurrentStep, stopPlayback,
} from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { SceneObject, AnimationStep } from '../../types/scene';
import {
  Scene, Circle, Square,
  Create, FadeIn, FadeOut, Write,
  GrowFromCenter, Transform, Indicate,
  BLACK, Shift,
} from 'manim-web';

let MWTriangle: any = null;
try { MWTriangle = (await import('manim-web') as any).Triangle; } catch { /**/ }

const W = 854;
const H = 480;
const SCALE = 60;
const mx = (x: number) => W / 2 + x * SCALE;
const my = (y: number) => H / 2 - y * SCALE;

// ─── Интерполяция для seek-preview ───────────────────────────────────────────

function interpolateObjectAtTime(
    obj: SceneObject,
    steps: AnimationStep[],
    previewTime: number,
): SceneObject {
  if (previewTime <= 0) return obj;
  const sorted = [...steps]
      .filter(s => s.objectId === obj.id)
      .sort((a, b) => a.order - b.order);
  let result = { ...obj, props: { ...obj.props } };
  let elapsed = 0;
  for (const step of sorted) {
    const start = elapsed;
    const end = elapsed + step.duration;
    if (previewTime <= start) break;
    const t = Math.min(1, (previewTime - start) / step.duration);
    if (step.animationType === 'MoveTo' && step.params?.targetPosition) {
      const [tx, ty, tz] = step.params.targetPosition;
      const [sx, sy, sz] = result.props.position;
      result = { ...result, props: {
          ...result.props,
          position: [sx + (tx - sx) * t, sy + (ty - sy) * t, sz + (tz - sz) * t],
        }};
    }
    if (step.animationType === 'FadeOut')
      result = { ...result, props: { ...result.props, fillOpacity: result.props.fillOpacity * (1 - t) } };
    if (step.animationType === 'FadeIn' || step.animationType === 'Create')
      result = { ...result, props: { ...result.props, fillOpacity: result.props.fillOpacity * t } };
    elapsed = end;
  }
  return result;
}

// ─── Canvas 2D рендер ─────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawObject(ctx: CanvasRenderingContext2D, obj: SceneObject, selected: boolean) {
  const { props, type } = obj;
  const [ox, oy] = props.position;
  const cx = mx(ox), cy = my(oy), sw = props.strokeWidth ?? 2;
  ctx.save();
  ctx.strokeStyle = selected ? '#fff' : props.color;
  ctx.lineWidth = selected ? sw + 1.5 : sw;
  ctx.fillStyle = hexToRgba(props.color, props.fillOpacity);
  if (type === 'circle') {
    const r = (props.radius ?? 1) * SCALE;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  } else if (type === 'square') {
    const s = (props.sideLength ?? 2) * SCALE;
    ctx.beginPath(); ctx.rect(cx-s/2, cy-s/2, s, s); ctx.fill(); ctx.stroke();
  } else {
    const s = (props.sideLength ?? 2) * SCALE, h = s * Math.sqrt(3)/2;
    ctx.beginPath(); ctx.moveTo(cx, cy-h*2/3); ctx.lineTo(cx+s/2, cy+h/3); ctx.lineTo(cx-s/2, cy+h/3); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    const pad = 8;
    if (type === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, (props.radius??1)*SCALE+pad, 0, Math.PI*2); ctx.stroke(); }
    else { const s=(props.sideLength??2)*SCALE+pad*2; ctx.beginPath(); ctx.rect(cx-s/2,cy-s/2,s,s); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function renderPreviewFrame(
    canvas: HTMLCanvasElement,
    objects: SceneObject[], steps: AnimationStep[],
    selectedId: string | null, previewTime: number,
) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#030712'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
  for (let x = W/2 % SCALE; x < W; x += SCALE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = H/2 % SCALE; y < H; y += SCALE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
  const vis = objects.filter(o => o.visible);
  for (const obj of [...vis.filter(o=>o.id!==selectedId), ...vis.filter(o=>o.id===selectedId)]) {
    drawObject(ctx, previewTime>0 ? interpolateObjectAtTime(obj,steps,previewTime) : obj, obj.id===selectedId);
  }
  ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'center';
  for (const obj of vis) {
    const interp = previewTime>0 ? interpolateObjectAtTime(obj,steps,previewTime) : obj;
    const [ox,oy] = interp.props.position;
    ctx.fillStyle = obj.id===selectedId ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)';
    ctx.fillText(obj.label, mx(ox), my(oy) - (obj.props.radius??obj.props.sideLength??2)*SCALE - 12);
  }
}

// ─── manim-web helpers ────────────────────────────────────────────────────────

function buildMobject(obj: SceneObject): any {
  const c = { color:obj.props.color, fillOpacity:obj.props.fillOpacity, strokeWidth:obj.props.strokeWidth??2 };
  if (obj.type==='circle') return new Circle({...c, radius:obj.props.radius??1});
  if (obj.type==='square') return new Square({...c, sideLength:obj.props.sideLength??2});
  return MWTriangle ? new MWTriangle({...c, sideLength:obj.props.sideLength??2}) : new Square({...c, sideLength:2});
}

async function runStep(scene:Scene, step:AnimationStep, mobMap:Map<string,any>, onScene:Set<string>) {
  const mob = mobMap.get(step.objectId); if (!mob) return;
  const dur = step.duration;
  const ensure = (id:string) => { if (!onScene.has(id)) { scene.add(mobMap.get(id)); onScene.add(id); } };
  try {
    switch (step.animationType) {
      case 'Create':        ensure(step.objectId); await scene.play(new Create(mob,{duration:dur} as any)); break;
      case 'FadeIn':        ensure(step.objectId); await scene.play(new FadeIn(mob,{duration:dur} as any)); break;
      case 'FadeOut':       ensure(step.objectId); await scene.play(new FadeOut(mob,{duration:dur} as any)); onScene.delete(step.objectId); break;
      case 'Write':         ensure(step.objectId); await scene.play(new Write(mob,{duration:dur} as any)); break;
      case 'GrowFromCenter':ensure(step.objectId); await scene.play(new GrowFromCenter(mob,{duration:dur} as any)); break;
      case 'Indicate':      ensure(step.objectId); await scene.play(new Indicate(mob,{duration:dur} as any)); break;
      case 'Transform': {
        const tgt = mobMap.get(step.params?.targetObjectId??'');
        ensure(step.objectId);
        if (tgt) { ensure(step.params!.targetObjectId!); await scene.play(new Transform(mob,tgt,{duration:dur} as any)); }
        else await scene.play(new Indicate(mob,{duration:dur} as any));
        break;
      }
      case 'MoveTo': {
        const pos = step.params?.targetPosition ?? [0, 0, 0];
        // ensureOnScene(step.objectId);
        try {
          if (mob.animate?.moveTo) {
            await scene.play(mob.animate.moveTo(pos) as any);
          } else {
            // mob.moveTo?.(pos);
            // await scene.wait(dur);
            await scene.play(new Shift(mob, {direction: pos, duration: dur}));
          }
        } catch {
          // mob.moveTo?.(pos);
          // await scene.wait(dur);
          await scene.play(new Shift(mob, {direction: pos}));
        }
        break;
      }
    }
  } catch(e) { console.error(`Step[${step.animationType}]:`,e); await new Promise(r=>setTimeout(r,dur*1000)); }
}

// ─── PlayerBar component ──────────────────────────────────────────────────────

function BarBtn({children,onClick,title,size=28}: {children:React.ReactNode;onClick:()=>void;title?:string;size?:number}) {
  const [h,setH] = useState(false);
  return <button title={title} onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
                 style={{width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center',
                   background:h?'rgba(255,255,255,0.15)':'none',border:'none',color:'#fff',cursor:'pointer',
                   padding:0,borderRadius:4,outline:'none',transition:'background 0.12s'}}>{children}</button>;
}

interface PlayerBarProps {
  currentTime:number; duration:number; isPlaying:boolean; playbackRate:number;
  segmentTimes:number[];
  onPlayPause:()=>void; onPrev:()=>void; onNext:()=>void;
  onSeek:(t:number)=>void; onSpeedChange:(r:number)=>void; onFullscreen:()=>void;
}

function PlayerBar({currentTime,duration,isPlaying,playbackRate,segmentTimes,
                     onPlayPause,onPrev,onNext,onSeek,onSpeedChange,onFullscreen}: PlayerBarProps) {
  const [dragging,setDragging]=useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = duration>0 ? (currentTime/duration)*100 : 0;
  const fmt = (s:number) => {
    const m=Math.floor(s/60),sec=Math.floor(s%60),cs=Math.floor((s%1)*100);
    return `${m}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };
  const seekFromMouse = useCallback((e:React.MouseEvent|MouseEvent) => {
    const t = trackRef.current; if (!t||duration<=0) return;
    const rect = t.getBoundingClientRect();
    onSeek(Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*duration);
  },[duration,onSeek]);
  useEffect(()=>{
    if (!dragging) return;
    const mv=(e:MouseEvent)=>seekFromMouse(e), up=()=>setDragging(false);
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
    return ()=>{ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
  },[dragging,seekFromMouse]);

  return (
      <div data-player-bar="" style={{
        position:'absolute',bottom:0,left:0,right:0,
        background:'linear-gradient(transparent,rgba(0,0,0,0.88))',
        color:'#fff',fontFamily:'system-ui,sans-serif',fontSize:13,userSelect:'none',
      }}>

      </div>
  );
}

// ─── Exported handle ──────────────────────────────────────────────────────────

export interface CanvasHandle {
  playAll: () => Promise<void>;
  stopAll: () => void;
  /** Edit-mode seek: показывает состояние объектов в момент времени time */
  seekPreview: (time: number) => void;
}

// ─── ManimCanvas ──────────────────────────────────────────────────────────────

const ManimCanvas = forwardRef<CanvasHandle>((_, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const previewRef = useRef<HTMLCanvasElement>(null);
  const webglRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playSceneRef = useRef<Scene | null>(null);
  const abortRef = useRef(false);
  const mountedRef = useRef(true);
  const playbackRateRef = useRef(1);

  const objects = useSelector((s: RootState) => s.editor.objects);
  const selectedId = useSelector((s: RootState) => s.editor.selectedObjectId);
  const isPlaying = useSelector((s: RootState) => s.editor.isPlaying);
  const steps = useSelector((s: RootState) => s.editor.animationSteps);

  const [playbackRate, setPlaybackRateState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);

  const totalDuration = steps.reduce((s, a) => s + a.duration, 0);
  const sortedSteps = [...steps].sort((a,b) => a.order - b.order);
  const segmentTimes = sortedSteps.reduce<number[]>((acc, _, i) =>
      [...acc, i===0 ? 0 : acc[i-1] + sortedSteps[i-1].duration], []);

  useEffect(() => { mountedRef.current=true; return ()=>{ mountedRef.current=false; try{(playSceneRef.current as any)?.dispose?.();}catch{/***/} }; },[]);

  // Live preview
  useEffect(() => {
    if (isPlaying) return;
    if (previewRef.current) renderPreviewFrame(previewRef.current, objects, steps, selectedId, previewTime);
  }, [objects, selectedId, isPlaying, steps, previewTime]);

  const seekPreview = useCallback((time: number) => {
    setPreviewTime(Math.max(0, Math.min(time, totalDuration)));
  }, [totalDuration]);

  const playAll = useCallback(async () => {
    if (!webglRef.current) return;
    if (sortedSteps.length === 0) return;
    try{(playSceneRef.current as any)?.dispose?.();}catch{/***/}
    const scene = new Scene(webglRef.current, {width:W,height:H,backgroundColor:BLACK} as any);
    playSceneRef.current = scene;
    const mobMap = new Map<string,any>();
    for (const obj of objects.filter(o=>o.visible)) {
      const mob = buildMobject(obj); mob.moveTo?.(obj.props.position); mobMap.set(obj.id, mob);
    }
    const onScene = new Set<string>();
    abortRef.current = false;
    dispatch(setIsPlaying(true));
    setCurrentTime(0);
    // Ticker
    let elapsed=0, last=performance.now(), rafId=0;
    const tick=(now:number)=>{ if(abortRef.current) return; elapsed+=(now-last)/1000*playbackRateRef.current; last=now; setCurrentTime(Math.min(elapsed,totalDuration)); rafId=requestAnimationFrame(tick); };
    rafId=requestAnimationFrame(tick);
    try {
      for (let i=0;i<sortedSteps.length;i++) {
        if(abortRef.current||!mountedRef.current) break;
        dispatch(setCurrentStep(i));
        await runStep(scene, sortedSteps[i], mobMap, onScene);
      }
      if(mountedRef.current&&!abortRef.current) await scene.wait(0.3);
    } catch(e){console.error('Playback:',e);}
    finally {
      cancelAnimationFrame(rafId);
      if(mountedRef.current){
        dispatch(stopPlayback());
        try{(playSceneRef.current as any)?.dispose?.();}catch{/***/}
        playSceneRef.current=null; setCurrentTime(0);
        if(previewRef.current) renderPreviewFrame(previewRef.current,objects,steps,selectedId,previewTime);
      }
    }
  },[sortedSteps,objects,selectedId,dispatch,totalDuration,previewTime,steps]);

  const stopAll = useCallback(()=>{
    abortRef.current=true; dispatch(stopPlayback());
    try{(playSceneRef.current as any)?.dispose?.();}catch{/***/}
    playSceneRef.current=null; setCurrentTime(0);
    if(previewRef.current) renderPreviewFrame(previewRef.current,objects,steps,selectedId,previewTime);
  },[dispatch,objects,selectedId,steps,previewTime]);

  // Segment navigation
  const prevSeg = useCallback(()=>{
    const prev=[...segmentTimes].reverse().find(t=>t<currentTime-0.3);
    setCurrentTime(prev??0);
  },[segmentTimes,currentTime]);
  const nextSeg = useCallback(()=>{
    const next=segmentTimes.find(t=>t>currentTime+0.1);
    if(next!==undefined) setCurrentTime(next);
  },[segmentTimes,currentTime]);

  const handleSpeedChange = useCallback((r:number)=>{ setPlaybackRateState(r); playbackRateRef.current=r; },[]);
  const handleSeek = useCallback((t:number)=>setCurrentTime(t),[]);
  const handleFullscreen = useCallback(()=>{
    const el=containerRef.current; if(!el) return;
    document.fullscreenElement===el ? document.exitFullscreen() : el.requestFullscreen().catch(()=>{/***/});
  },[]);

  // Keyboard shortcuts
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const tag=(e.target as HTMLElement)?.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
      switch(e.key){
        case ' ': case 'k': e.preventDefault(); isPlaying?stopAll():playAll(); break;
        case 'ArrowLeft': e.preventDefault(); e.shiftKey?handleSeek(Math.max(0,currentTime-1)):prevSeg(); break;
        case 'ArrowRight': e.preventDefault(); e.shiftKey?handleSeek(Math.min(totalDuration,currentTime+1)):nextSeg(); break;
        case 'f': case 'F': e.preventDefault(); handleFullscreen(); break;
        case 'Home': e.preventDefault(); handleSeek(0); break;
        case 'End': e.preventDefault(); handleSeek(totalDuration); break;
      }
    };
    const el=containerRef.current;
    el?.addEventListener('keydown',onKey);
    return ()=>el?.removeEventListener('keydown',onKey);
  },[isPlaying,playAll,stopAll,prevSeg,nextSeg,handleSeek,handleFullscreen,currentTime,totalDuration]);

  useImperativeHandle(ref,()=>({playAll,stopAll,seekPreview}),[playAll,stopAll,seekPreview]);

  return (
      <div ref={containerRef} tabIndex={0}
           style={{position:'relative',width:'100%',height:'100%',display:'flex',
             alignItems:'center',justifyContent:'center',background:'#0a0a14',outline:'none'}}>

        {/* Canvas 2D */}
        <canvas ref={previewRef} width={W} height={H}
                style={{position:'absolute',borderRadius:6,
                  border:'1px solid rgba(255,255,255,0.07)',
                  boxShadow:'0 0 0 1px rgba(88,196,221,0.08),0 20px 60px rgba(0,0,0,0.6)',
                  opacity:isPlaying?0:1,transition:'opacity 0.2s',
                  pointerEvents:isPlaying?'none':'auto'}}
                onClick={()=>{ if(!isPlaying) dispatch(selectObject(null)); }}/>

        {/* WebGL */}
        <div ref={webglRef}
             style={{position:'absolute',width:W,height:H,borderRadius:6,overflow:'hidden',
               border:'1px solid rgba(255,255,255,0.07)',
               boxShadow:'0 0 0 1px rgba(88,196,221,0.08),0 20px 60px rgba(0,0,0,0.6)',
               opacity:isPlaying?1:0,transition:'opacity 0.2s',pointerEvents:'none',background:'#030712'}}/>

        {/* PlayerBar overlay */}
        {isPlaying && (
            <div style={{position:'absolute',
              top:`calc(50% - ${H/2}px)`,left:`calc(50% - ${W/2}px)`,
              width:W,height:H,pointerEvents:'auto'}}>
              <PlayerBar
                  currentTime={currentTime} duration={totalDuration}
                  isPlaying={isPlaying} playbackRate={playbackRate}
                  segmentTimes={segmentTimes}
                  onPlayPause={()=>isPlaying?stopAll():playAll()}
                  onPrev={prevSeg} onNext={nextSeg}
                  onSeek={handleSeek} onSpeedChange={handleSpeedChange}
                  onFullscreen={handleFullscreen}/>
            </div>
        )}

        {/* Edit-mode seek indicator */}
        {!isPlaying && previewTime>0 && (
            <div style={{position:'absolute',
              top:`calc(50% - ${H/2}px)`,left:`calc(50% - ${W/2}px)`,
              padding:'3px 10px',background:'rgba(88,196,221,0.15)',
              border:'1px solid rgba(88,196,221,0.4)',borderRadius:20,
              fontSize:11,color:'#58C4DD',fontFamily:'monospace',fontWeight:700,pointerEvents:'none'}}>
              ⏱ PREVIEW {previewTime.toFixed(2)}s
            </div>
        )}

        {/* Dimension label */}
        <div style={{position:'absolute',
          bottom:`calc(50% - ${H/2+18}px)`,left:`calc(50% - ${W/2}px)`,
          fontSize:9,color:'rgba(255,255,255,0.1)',fontFamily:'monospace'}}>854 × 480</div>

        {/* Empty state */}
        {objects.length===0 && (
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',gap:12,
              color:'rgba(255,255,255,0.06)',pointerEvents:'none'}}>
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <circle cx="30" cy="30" r="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
                <rect x="7" y="7" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
                <polygon points="44,7 55,26 33,26" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
              </svg>
              <span style={{fontSize:11,letterSpacing:'0.14em',fontFamily:'monospace',textTransform:'uppercase'}}>
            Add objects from the layers panel
          </span>
            </div>
        )}
      </div>
  );
});
ManimCanvas.displayName = 'ManimCanvas';
export default ManimCanvas;