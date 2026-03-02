import { useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateObjectProps, deleteObject, duplicateObject } from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { ObjectProps } from '../../types/scene';

// ── NumberDragger ────────────────────────────────────────────────────────────

interface NDProps { label: string; value: number; onChange:(v:number)=>void; step?:number; min?:number; max?:number; precision?:number; unit?:string; accent?:string; }

function NumberDragger({ label, value, onChange, step=0.05, min=-100, max=100, precision=2, unit, accent='#58C4DD' }: NDProps) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const sx = useRef(0), sv = useRef(0), moved = useRef(false);

  const onMD = useCallback((e: React.MouseEvent) => {
    if (editing) return;
    e.preventDefault();
    sx.current=e.clientX; sv.current=value; moved.current=false;
    const mv=(ev:MouseEvent)=>{ const dx=ev.clientX-sx.current; if(Math.abs(dx)>2)moved.current=true; onChange(parseFloat(Math.min(max,Math.max(min,sv.current+dx*step)).toFixed(precision))); };
    const up=()=>{ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); if(!moved.current){setEditVal(value.toFixed(precision));setEditing(true);} };
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  }, [editing,value,step,min,max,onChange,precision]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <span style={{fontSize:7.5,color:'#2e2e48',fontFamily:'monospace',letterSpacing:'0.1em',textTransform:'uppercase'}}>{label}</span>
      {editing ? (
        <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
          onBlur={()=>{const v=parseFloat(editVal);if(!isNaN(v))onChange(Math.min(max,Math.max(min,v)));setEditing(false);}}
          onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape'){const v=parseFloat(editVal);if(!isNaN(v))onChange(Math.min(max,Math.max(min,v)));setEditing(false);}}}
          style={{width:'100%',background:'#1a1a28',border:`1px solid ${accent}55`,borderRadius:3,color:'#d0d0f0',padding:'3px 5px',fontSize:10,fontFamily:'monospace',outline:'none'}}/>
      ) : (
        <div onMouseDown={onMD}
          style={{background:'#0f0f1c',border:'1px solid #1c1c2e',borderRadius:3,padding:'3px 7px',fontSize:10,fontFamily:'monospace',color:'#8888b8',cursor:'ew-resize',userSelect:'none',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'border-color 0.1s'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor='#2a2a44'}
          onMouseLeave={e=>e.currentTarget.style.borderColor='#1c1c2e'}>
          <span>{value.toFixed(precision)}</span>
          {unit&&<span style={{fontSize:8,color:'#2a2a40'}}>{unit}</span>}
        </div>
      )}
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

function Sec({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div style={{padding:'10px 10px 8px',borderBottom:'1px solid #0f0f1e'}}>
      <div style={{fontSize:7.5,fontWeight:700,letterSpacing:'0.14em',color:'#1e1e38',textTransform:'uppercase',fontFamily:'monospace',marginBottom:8}}>{title}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children:React.ReactNode }) {
  return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>{children}</div>;
}

// ── ColorSwatch ──────────────────────────────────────────────────────────────

function ColorRow({ label, value, onChange }: { label:string; value:string; onChange:(c:string)=>void }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <span style={{fontSize:7.5,color:'#2e2e48',fontFamily:'monospace',letterSpacing:'0.1em',textTransform:'uppercase'}}>{label}</span>
      <div style={{display:'flex',gap:4,alignItems:'center'}}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)}
          style={{width:28,height:24,padding:1,border:'1px solid #1c1c2e',borderRadius:3,background:'#0f0f1c',cursor:'pointer'}}/>
        <input value={value} onChange={e=>onChange(e.target.value)}
          style={{flex:1,background:'#0f0f1c',border:'1px solid #1c1c2e',borderRadius:3,color:'#8888b8',padding:'3px 5px',fontSize:10,fontFamily:'monospace',outline:'none'}}/>
      </div>
    </div>
  );
}

// ── PropertiesPanel ──────────────────────────────────────────────────────────

export default function PropertiesPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const objects = useSelector((s:RootState) => s.editor.present.objects);
  const selectedId = useSelector((s:RootState) => s.editor.selectedObjectId);
  const obj = objects.find(o => o.id === selectedId);

  const upd = (props: Partial<ObjectProps>) => {
    if (!obj) return;
    dispatch(updateObjectProps({ id: obj.id, props }));
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#070710',borderLeft:'1px solid #141422',overflow:'hidden'}}>
      <div style={{padding:'9px 10px',borderBottom:'1px solid #0f0f1e',flexShrink:0}}>
        <span style={{fontSize:8,fontWeight:700,letterSpacing:'0.14em',color:'#1e1e38',textTransform:'uppercase',fontFamily:'monospace'}}>PROPERTIES</span>
      </div>

      {!obj ? (
        <div style={{padding:'20px 12px',fontSize:10,color:'#14142a',textAlign:'center',fontFamily:'monospace',letterSpacing:'0.05em'}}>
          Select an object<br/><span style={{fontSize:8,color:'#0e0e20'}}>Click on canvas or layers</span>
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto'}}>
          <Sec title="Identity">
            <div style={{marginBottom:6}}>
              <span style={{fontSize:7.5,color:'#2e2e48',fontFamily:'monospace',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:2}}>Name</span>
              <input value={obj.label} onChange={e=>dispatch({type:'editor/updateObjectLabel',payload:{id:obj.id,label:e.target.value}})}
                style={{width:'100%',background:'#0f0f1c',border:'1px solid #1c1c2e',borderRadius:3,color:'#9090c0',padding:'3px 6px',fontSize:10,fontFamily:'monospace',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',gap:4}}>
              <span style={{fontSize:8,fontFamily:'monospace',color:'#1c1c34',padding:'2px 6px',background:'#0a0a18',borderRadius:3,border:'1px solid #141428'}}>{obj.type}</span>
              {obj.locked&&<span style={{fontSize:8,fontFamily:'monospace',color:'#6060a0',padding:'2px 6px',background:'rgba(96,96,160,0.1)',borderRadius:3,border:'1px solid rgba(96,96,160,0.2)'}}>🔒</span>}
            </div>
          </Sec>

          <Sec title="Position">
            <Row>
              <NumberDragger label="X" value={obj.props.position[0]} step={0.05} precision={2} onChange={v=>upd({position:[v,obj.props.position[1],obj.props.position[2]]})} accent='#58C4DD'/>
              <NumberDragger label="Y" value={obj.props.position[1]} step={0.05} precision={2} onChange={v=>upd({position:[obj.props.position[0],v,obj.props.position[2]]})} accent='#83C167'/>
            </Row>
            <Row>
              <NumberDragger label="Rotation °" value={obj.props.rotation??0} step={1} min={-360} max={360} precision={0} onChange={v=>upd({rotation:v})} accent='#FFDD55'/>
              <NumberDragger label="Scale" value={obj.props.scale??1} step={0.01} min={0.01} max={20} precision={2} onChange={v=>upd({scale:v})} accent='#C77DBB'/>
            </Row>
          </Sec>

          <Sec title="Appearance">
            <div style={{marginBottom:6}}>
              <ColorRow label="Color" value={obj.props.color} onChange={c=>upd({color:c})}/>
            </div>
            <Row>
              <NumberDragger label="Fill Opacity" value={obj.props.fillOpacity} step={0.01} min={0} max={1} precision={2} onChange={v=>upd({fillOpacity:v})}/>
              <NumberDragger label="Stroke" value={obj.props.strokeWidth??2} step={0.1} min={0} max={20} precision={1} unit="px" onChange={v=>upd({strokeWidth:v})}/>
            </Row>
          </Sec>

          {obj.type==='circle'&&(
            <Sec title="Circle">
              <NumberDragger label="Radius" value={obj.props.radius??1} step={0.05} min={0.05} max={10} precision={2} onChange={v=>upd({radius:v})}/>
            </Sec>
          )}
          {(obj.type==='square'||obj.type==='triangle')&&(
            <Sec title={obj.type==='square'?'Square':'Triangle'}>
              <NumberDragger label="Side Length" value={obj.props.sideLength??2} step={0.05} min={0.1} max={10} precision={2} onChange={v=>upd({sideLength:v})}/>
            </Sec>
          )}
          {obj.type==='text'&&(
            <Sec title="Text">
              <div style={{marginBottom:6}}>
                <span style={{fontSize:7.5,color:'#2e2e48',fontFamily:'monospace',letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:2}}>Content</span>
                <input value={obj.props.text??''} onChange={e=>upd({text:e.target.value})}
                  style={{width:'100%',background:'#0f0f1c',border:'1px solid #1c1c2e',borderRadius:3,color:'#9090c0',padding:'4px 6px',fontSize:11,fontFamily:'monospace',outline:'none',boxSizing:'border-box'}}/>
              </div>
              <NumberDragger label="Font Size" value={obj.props.fontSize??36} step={1} min={8} max={200} precision={0} onChange={v=>upd({fontSize:v})}/>
            </Sec>
          )}
          {(obj.type==='line'||obj.type==='arrow')&&(
            <Sec title={obj.type}>
              <NumberDragger label="Length" value={obj.props.width??3} step={0.1} min={0.2} max={15} precision={2} onChange={v=>upd({width:v})}/>
            </Sec>
          )}

          <Sec title="Actions">
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              <button onClick={()=>dispatch(duplicateObject(obj.id))} style={actnBtn('#4a6a4a','rgba(131,193,103,0.1)','rgba(131,193,103,0.18)')}>Duplicate</button>
              <button onClick={()=>dispatch({type:'editor/toggleVisibility',payload:obj.id})} style={actnBtn('#4a4a6a','rgba(88,196,221,0.1)','rgba(88,196,221,0.18)')}>{obj.visible?'Hide':'Show'}</button>
              <button onClick={()=>dispatch({type:'editor/toggleLock',payload:obj.id})} style={actnBtn('#5a5a4a','rgba(255,221,85,0.1)','rgba(255,221,85,0.18)')}>{obj.locked?'Unlock':'Lock'}</button>
              <button onClick={()=>dispatch(deleteObject(obj.id))} style={actnBtn('#6a3a3a','rgba(252,98,85,0.1)','rgba(252,98,85,0.18)')}>Delete</button>
            </div>
          </Sec>
        </div>
      )}
    </div>
  );
}

function actnBtn(color:string, bg:string, hoverBg:string): React.CSSProperties {
  return {padding:'4px 10px',borderRadius:4,fontSize:9,fontFamily:'monospace',background:bg,border:`1px solid ${bg}`,color:color,cursor:'pointer',letterSpacing:'0.04em'};
}
