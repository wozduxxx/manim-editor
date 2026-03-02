import { useRef } from 'react';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store, undo, redo } from './store/editorStore';
import ManimCanvas, { type CanvasHandle } from './components/canvas/ManimCanvas';
import PropertiesPanel from './components/panel/PropertiesPanel';
import ObjectsPanel from './components/panel/ObjectsPanel';
import TimelinePanel from './components/timeline/TimelinePanel';
import { downloadPythonScript } from './utils/pythonExporter';
import type { RootState, AppDispatch } from './store/editorStore';

function Toolbar({ canvasRef }: { canvasRef: React.RefObject<CanvasHandle|null> }) {
  const dispatch = useDispatch<AppDispatch>();
  const objects   = useSelector((s:RootState) => s.editor.present.objects);
  const steps     = useSelector((s:RootState) => s.editor.present.animationSteps);
  const isPlaying = useSelector((s:RootState) => s.editor.isPlaying);
  const canUndo   = useSelector((s:RootState) => s.editor.past.length > 0);
  const canRedo   = useSelector((s:RootState) => s.editor.future.length > 0);

  return (
    <header style={{height:44,display:'flex',alignItems:'center',gap:8,padding:'0 14px',background:'#060610',borderBottom:'1px solid #131320',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginRight:6}}>
        <div style={{width:26,height:26,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#58C4DD 0%,#6060ee 100%)',boxShadow:'0 0 14px rgba(88,196,221,0.25)',flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:900,color:'#fff',fontFamily:'monospace',lineHeight:1}}>M</span>
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'#c0c0e8',letterSpacing:'-0.01em',lineHeight:1.1}}>Manim Editor</div>
          <div style={{fontSize:7.5,color:'#1e1e34',fontFamily:'monospace',letterSpacing:'0.08em'}}>VISUAL STUDIO</div>
        </div>
      </div>

      <div style={{width:1,height:20,background:'#1a1a28',margin:'0 4px'}}/>

      <button onClick={()=>dispatch(undo())} disabled={!canUndo} title="Undo (Ctrl+Z)"
        style={{...tbBtn, opacity:canUndo?1:0.25}}>↩ Undo</button>
      <button onClick={()=>dispatch(redo())} disabled={!canRedo} title="Redo (Ctrl+Y)"
        style={{...tbBtn, opacity:canRedo?1:0.25}}>↪ Redo</button>

      <div style={{width:1,height:20,background:'#1a1a28',margin:'0 4px'}}/>

      <button onClick={()=>isPlaying?canvasRef.current?.stopAll():canvasRef.current?.playAll()} disabled={steps.length===0}
        style={{...tbBtn, background:isPlaying?'rgba(252,98,85,0.18)':'rgba(131,193,103,0.12)', color:isPlaying?'#FC6255':steps.length===0?'#1a2a1a':'#83C167', border:`1px solid ${isPlaying?'rgba(252,98,85,0.28)':'rgba(131,193,103,0.18)'}`}}>
        {isPlaying?'■ Stop':'▶ Play All'}
      </button>

      <div style={{flex:1}}/>

      <span style={{fontSize:9,color:'#1a1a30',fontFamily:'monospace'}}>{objects.length} obj · {steps.length} steps</span>

      <button onClick={()=>downloadPythonScript(objects,steps)} style={{...tbBtn,color:'#4a6a4a',border:'1px solid rgba(131,193,103,0.12)'}}
        onMouseEnter={e=>e.currentTarget.style.color='#83C167'} onMouseLeave={e=>e.currentTarget.style.color='#4a6a4a'}>
        🐍 Export .py
      </button>
    </header>
  );
}

const tbBtn: React.CSSProperties = {padding:'5px 11px',borderRadius:5,cursor:'pointer',fontSize:9,fontWeight:700,fontFamily:'monospace',letterSpacing:'0.04em',background:'transparent',border:'1px solid #1a1a28',color:'#3a3a60',transition:'all 0.1s'};

function Editor() {
  const canvasRef = useRef<CanvasHandle>(null);
  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#0d0d1a',color:'#e0e0f0',overflow:'hidden'}}>
      <Toolbar canvasRef={canvasRef}/>
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <div style={{width:185,flexShrink:0}}><ObjectsPanel/></div>
        <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
          <div style={{flex:1,overflow:'hidden'}}><ManimCanvas ref={canvasRef}/></div>
          <TimelinePanel canvasRef={canvasRef}/>
        </div>
        <div style={{width:220,flexShrink:0}}><PropertiesPanel/></div>
      </div>
    </div>
  );
}

export default function App() {
  return <Provider store={store}><Editor/></Provider>;
}
