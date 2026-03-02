import { useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addAnimationStep, deleteAnimationStep, selectStep, updateAnimationStep, dragStepStartTime, resizeStepDuration, startStepDrag } from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { AnimationType } from '../../types/scene';
import type { CanvasHandle } from '../canvas/ManimCanvas';

const ANIM_TYPES: AnimationType[] = ['Create','FadeIn','FadeOut','Write','GrowFromCenter','Transform','Indicate','MoveTo','Rotate','ScaleInPlace','Flash','ReplacementTransform'];
const ANIM_COLOR: Record<string,string> = {
  Create:'#58C4DD',FadeIn:'#83C167',FadeOut:'#FC6255',Write:'#FFDD55',GrowFromCenter:'#C77DBB',
  Transform:'#FF8C42',Indicate:'#FFD166',MoveTo:'#06D6A0',Rotate:'#E07AFF',ScaleInPlace:'#FF6B9D',Flash:'#FFB347',ReplacementTransform:'#FF8C42'
};
const PX=80, RH=32, LW=130, RLH=20;

interface Props { canvasRef: React.RefObject<CanvasHandle | null>; }

export default function TimelinePanel({ canvasRef }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef  = useRef<HTMLDivElement>(null);
  const [dragPH, setDragPH] = useState<number|null>(null);

  const objects   = useSelector((s:RootState) => s.editor.present.objects);
  const steps     = useSelector((s:RootState) => s.editor.present.animationSteps);
  const selObjId  = useSelector((s:RootState) => s.editor.selectedObjectId);
  const selStepId = useSelector((s:RootState) => s.editor.selectedStepId);
  const isPlaying = useSelector((s:RootState) => s.editor.isPlaying);
  const curStep   = useSelector((s:RootState) => s.editor.currentStep);

  const sorted = [...steps].sort((a,b) => a.startTime - b.startTime);
  const totalDur = sorted.length>0 ? Math.max(...sorted.map(s=>s.startTime+s.duration)) : 4;
  const trackW = Math.max(totalDur*PX+200, 500);
  const selStep = steps.find(s=>s.id===selStepId);
  const activeObjId = selObjId ?? objects[0]?.id;

  const handleRulerDown = useCallback((e: React.MouseEvent) => {
    if (!rulerRef.current || !scrollRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const sx = scrollRef.current.scrollLeft;
    const getT = (ex:number) => Math.min(Math.max((ex-rect.left+sx)/PX, 0), totalDur);
    const t = getT(e.clientX);
    if (isPlaying) canvasRef.current?.stopAll();
    setDragPH(t); canvasRef.current?.seekPreview(t);
    const mv = (ev:MouseEvent) => { const nt=getT(ev.clientX); setDragPH(nt); canvasRef.current?.seekPreview(nt); };
    const up = () => { setDragPH(null); document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  }, [isPlaying, totalDur, canvasRef]);

  const handleBlockDown = useCallback((e: React.MouseEvent, stepId: string, curStart: number) => {
    e.stopPropagation();
    if (isPlaying) return;
    dispatch(selectStep(stepId)); dispatch(startStepDrag());
    const ix = e.clientX;
    const mv = (ev:MouseEvent) => { const dx=ev.clientX-ix; dispatch(dragStepStartTime({id:stepId,startTime:Math.round(Math.max(0,curStart+dx/PX)*10)/10})); };
    const up = () => { document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  }, [isPlaying, dispatch]);

  const handleResizeDown = useCallback((e: React.MouseEvent, stepId: string, curDur: number) => {
    e.stopPropagation();
    if (isPlaying) return;
    dispatch(startStepDrag());
    const ix = e.clientX;
    const mv = (ev:MouseEvent) => { const dx=ev.clientX-ix; dispatch(resizeStepDuration({id:stepId,duration:Math.round(Math.max(0.1,curDur+dx/PX)*10)/10})); };
    const up = () => { document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  }, [isPlaying, dispatch]);

  const phTime = dragPH ?? (isPlaying ? (sorted[curStep]?.startTime??0) : 0);

  return (
    <div style={{display:'flex',flexDirection:'column',background:'#08080e',borderTop:'1px solid #1a1a28',height:230,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 12px',height:36,borderBottom:'1px solid #141422',background:'#060610',flexShrink:0}}>
        <span style={{fontSize:8,fontWeight:700,letterSpacing:'0.14em',color:'#1e1e32',textTransform:'uppercase',fontFamily:'monospace'}}>TIMELINE</span>
        <button onClick={()=>isPlaying?canvasRef.current?.stopAll():canvasRef.current?.playAll()} disabled={sorted.length===0}
          style={{padding:'4px 10px',borderRadius:5,cursor:sorted.length===0?'not-allowed':'pointer',fontSize:9,fontWeight:700,fontFamily:'monospace',
          background:isPlaying?'rgba(252,98,85,0.18)':'rgba(131,193,103,0.13)',
          color:isPlaying?'#FC6255':sorted.length===0?'#1a2a1a':'#83C167',
          border:`1px solid ${isPlaying?'rgba(252,98,85,0.28)':'rgba(131,193,103,0.18)'}`}}>
          {isPlaying?'■ Stop':'▶ Play'}
        </button>
        <span style={{fontSize:9,color:'#1e1e34',fontFamily:'monospace'}}>{totalDur.toFixed(1)}s</span>
        <div style={{flex:1}}/>
        {activeObjId&&!isPlaying&&<>
          <span style={{fontSize:8,color:'#2a2a44',fontFamily:'monospace'}}>+ Add:</span>
          <select defaultValue="" onChange={e=>{if(!e.target.value)return;dispatch(addAnimationStep({objectId:activeObjId,animationType:e.target.value as AnimationType}));e.target.value='';}}
            style={{background:'#111120',border:'1px solid #222238',color:'#6060a0',borderRadius:4,padding:'2px 5px',fontSize:9,fontFamily:'monospace',cursor:'pointer'}}>
            <option value="" disabled>Animation</option>
            {ANIM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </>}
        {selStep&&!isPlaying&&<>
          <label style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#3a3a60',fontFamily:'monospace'}}>
            dur<input type="number" min={0.1} max={20} step={0.1} value={selStep.duration}
              onChange={e=>dispatch(updateAnimationStep({id:selStep.id,changes:{duration:Math.max(0.1,parseFloat(e.target.value)||1)}}))}
              style={{width:38,background:'#111120',border:'1px solid #222238',color:'#7070a0',borderRadius:3,padding:'1px 3px',fontSize:9,fontFamily:'monospace'}}/>s
          </label>
          <button onClick={()=>dispatch(deleteAnimationStep(selStepId!))}
            style={{padding:'2px 7px',borderRadius:4,fontSize:9,background:'rgba(252,98,85,0.08)',border:'1px solid rgba(252,98,85,0.18)',color:'#a05050',cursor:'pointer',fontFamily:'monospace'}}>✕</button>
        </>}
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>
        <div style={{width:LW,flexShrink:0,borderRight:'1px solid #141422',background:'#060610'}}>
          <div style={{height:RLH,borderBottom:'1px solid #0e0e1e'}}/>
          {objects.length===0&&<div style={{padding:'8px 10px',fontSize:9,color:'#161628',fontFamily:'monospace'}}>No objects</div>}
          {objects.map(obj=>(
            <div key={obj.id} onClick={()=>dispatch({type:'editor/selectObject',payload:obj.id})}
              style={{height:RH,display:'flex',alignItems:'center',padding:'0 8px',borderBottom:'1px solid #0c0c18',cursor:'pointer',gap:6,background:obj.id===selObjId?'rgba(88,196,221,0.04)':'transparent'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:obj.props.color,flexShrink:0}}/>
              <span style={{fontSize:9,fontFamily:'monospace',color:obj.id===selObjId?'#9090c0':'#2e2e50',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{obj.label}</span>
            </div>
          ))}
        </div>

        <div ref={scrollRef} style={{flex:1,overflowX:'auto',overflowY:'hidden'}}>
          <div style={{width:trackW,minHeight:'100%',position:'relative'}}>
            <div ref={rulerRef} onMouseDown={handleRulerDown}
              style={{height:RLH,background:'#040410',borderBottom:'1px solid #0e0e1e',position:'sticky',top:0,zIndex:10,cursor:'col-resize',userSelect:'none'}}>
              {Array.from({length:Math.ceil(totalDur)+5}).map((_,i)=>(
                <div key={i} style={{position:'absolute',left:i*PX,top:0,height:'100%',borderLeft:`1px solid ${i===0?'transparent':'#111126'}`}}>
                  <span style={{position:'absolute',left:3,top:3,fontSize:8,color:'#282842',fontFamily:'monospace',userSelect:'none'}}>{i}s</span>
                </div>
              ))}
              {Array.from({length:(Math.ceil(totalDur)+5)*2}).map((_,i)=>(
                <div key={'h'+i} style={{position:'absolute',left:i*PX/2,bottom:0,height:5,borderLeft:'1px solid #0e0e1c'}}/>
              ))}
              <div style={{position:'absolute',left:phTime*PX,top:0,width:1,height:'100%',background:'#83C167',pointerEvents:'none'}}>
                <div style={{position:'absolute',top:0,left:-4,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:'6px solid #83C167'}}/>
              </div>
            </div>

            {objects.map(obj=>(
              <div key={obj.id} style={{height:RH,position:'relative',borderBottom:'1px solid #0a0a16'}}>
                {Array.from({length:Math.ceil(totalDur)+5}).map((_,i)=>(
                  <div key={i} style={{position:'absolute',left:i*PX,top:0,width:1,height:'100%',background:'#0e0e1a'}}/>
                ))}
                {steps.filter(s=>s.objectId===obj.id).map(step=>{
                  const x=step.startTime*PX, w=Math.max(step.duration*PX-2,18);
                  const color=ANIM_COLOR[step.animationType]??'#888';
                  const isSel=step.id===selStepId;
                  const isAct=isPlaying&&sorted[curStep]?.id===step.id;
                  return (
                    <div key={step.id} onMouseDown={e=>handleBlockDown(e,step.id,step.startTime)} onClick={()=>dispatch(selectStep(step.id))}
                      title={step.animationType+' '+step.startTime.toFixed(1)+'s'}
                      style={{position:'absolute',left:x,top:3,width:w,height:RH-6,borderRadius:3,cursor:isPlaying?'default':'grab',
                        background:isSel?`${color}20`:`${color}0c`,border:`1px solid ${isSel?`${color}70`:`${color}28`}`,
                        borderLeft:`3px solid ${color}`,boxShadow:isAct?`0 0 8px ${color}55`:'none',
                        display:'flex',alignItems:'center',overflow:'hidden',userSelect:'none'}}>
                      <span style={{fontSize:8,color:color,fontFamily:'monospace',paddingLeft:4,flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{step.animationType}</span>
                      <div onMouseDown={e=>handleResizeDown(e,step.id,step.duration)}
                        style={{position:'absolute',right:0,top:0,width:6,height:'100%',cursor:'ew-resize',background:isSel?`${color}30`:'transparent',borderRadius:'0 3px 3px 0'}}/>
                    </div>
                  );
                })}
              </div>
            ))}

            <div style={{position:'absolute',left:phTime*PX,top:RLH,bottom:0,width:1,background:'rgba(131,193,103,0.25)',pointerEvents:'none'}}/>
          </div>
        </div>
      </div>

      {selStep&&(
        <div style={{height:34,display:'flex',alignItems:'center',gap:10,padding:'0 12px',borderTop:'1px solid #121220',background:'#050510',flexShrink:0,fontFamily:'monospace',fontSize:9}}>
          <span style={{color:ANIM_COLOR[selStep.animationType]??'#888'}}>{selStep.animationType}</span>
          <span style={{color:'#282840'}}>{selStep.startTime.toFixed(1)}s → {(selStep.startTime+selStep.duration).toFixed(1)}s</span>
          {(selStep.animationType==='Transform'||selStep.animationType==='ReplacementTransform')&&(
            <label style={{display:'flex',alignItems:'center',gap:4,color:'#3a3a60'}}>Target
              <select value={selStep.params?.targetObjectId??''} onChange={e=>dispatch(updateAnimationStep({id:selStep.id,changes:{params:{...selStep.params,targetObjectId:e.target.value}}}))}
                style={{background:'#111120',border:'1px solid #222238',color:'#6060a0',borderRadius:3,padding:'1px 4px',fontSize:9,fontFamily:'monospace'}}>
                <option value="">— none —</option>
                {objects.filter(o=>o.id!==selStep.objectId).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}
          {selStep.animationType==='MoveTo'&&(['x','y','z'] as const).map((ax,i)=>(
            <label key={ax} style={{display:'flex',alignItems:'center',gap:3,color:'#3a3a60'}}>{ax.toUpperCase()}
              <input type="number" step={0.1} value={selStep.params?.targetPosition?.[i]??0}
                onChange={e=>{const p=[...(selStep.params?.targetPosition??[0,0,0])] as [number,number,number];p[i]=parseFloat(e.target.value)||0;dispatch(updateAnimationStep({id:selStep.id,changes:{params:{...selStep.params,targetPosition:p}}}));}}
                style={{width:40,background:'#111120',border:'1px solid #222238',color:'#7070a0',borderRadius:3,padding:'1px 3px',fontSize:9,fontFamily:'monospace'}}/>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
