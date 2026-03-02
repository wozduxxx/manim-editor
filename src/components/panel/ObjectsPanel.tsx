import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addObject, selectObject, deleteObject, duplicateObject, toggleVisibility, toggleLock, updateObjectLabel } from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { ObjectType } from '../../types/scene';

const TYPE_ICON: Record<ObjectType, string> = { circle:'◉', square:'▣', triangle:'▲', text:'T', line:'—', arrow:'→' };
const ADD_BTNS: {type:ObjectType; label:string; color:string}[] = [
  {type:'circle',   label:'Circle',   color:'#58C4DD'},
  {type:'square',   label:'Square',   color:'#FC6255'},
  {type:'triangle', label:'Triangle', color:'#83C167'},
  {type:'text',     label:'Text',     color:'#FFDD55'},
  {type:'line',     label:'Line',     color:'#C77DBB'},
  {type:'arrow',    label:'Arrow',    color:'#FF8C42'},
];

export default function ObjectsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const objects = useSelector((s:RootState) => s.editor.present.objects);
  const selectedId = useSelector((s:RootState) => s.editor.selectedObjectId);
  const [editId, setEditId] = useState<string|null>(null);
  const [editVal, setEditVal] = useState('');

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#070710',borderRight:'1px solid #141422'}}>
      <div style={{padding:'9px 10px 8px',borderBottom:'1px solid #0f0f1e'}}>
        <span style={{fontSize:8,fontWeight:700,letterSpacing:'0.12em',color:'#1e1e38',textTransform:'uppercase',fontFamily:'monospace'}}>LAYERS</span>
      </div>

      <div style={{padding:'6px 8px',borderBottom:'1px solid #0d0d1c',display:'flex',flexWrap:'wrap',gap:3}}>
        {ADD_BTNS.map(btn=>(
          <button key={btn.type} onClick={()=>dispatch(addObject({type:btn.type}))}
            title={`Add ${btn.label}`}
            style={{padding:'3px 7px',borderRadius:4,fontSize:9,fontFamily:'monospace',cursor:'pointer',
              background:`${btn.color}0d`,border:`1px solid ${btn.color}22`,color:btn.color,
              letterSpacing:'0.03em',transition:'all 0.1s'}}
            onMouseEnter={e=>e.currentTarget.style.background=`${btn.color}22`}
            onMouseLeave={e=>e.currentTarget.style.background=`${btn.color}0d`}>
            <span style={{marginRight:3}}>{TYPE_ICON[btn.type]}</span>{btn.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {objects.length===0&&(
          <div style={{padding:'16px 12px',fontSize:10,color:'#12122a',textAlign:'center',fontFamily:'monospace',letterSpacing:'0.05em',marginTop:8}}>Add objects above</div>
        )}
        {[...objects].reverse().map(obj=>{
          const isSel = obj.id===selectedId;
          const isEdit = editId===obj.id;
          return (
            <div key={obj.id} onClick={()=>dispatch(selectObject(obj.id))}
              style={{display:'flex',alignItems:'center',gap:5,padding:'4px 8px 4px 10px',cursor:'pointer',background:isSel?'rgba(88,196,221,0.07)':'transparent',borderLeft:`2px solid ${isSel?obj.props.color:'transparent'}`,transition:'background 0.1s',userSelect:'none'}}>
              <span style={{fontSize:11,color:obj.props.color,opacity:obj.visible?1:0.3,flexShrink:0}}>{TYPE_ICON[obj.type]}</span>
              {isEdit?(
                <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                  onBlur={()=>{if(editVal.trim())dispatch(updateObjectLabel({id:obj.id,label:editVal.trim()}));setEditId(null);}}
                  onKeyDown={e=>{if(e.key==='Enter'){if(editVal.trim())dispatch(updateObjectLabel({id:obj.id,label:editVal.trim()}));setEditId(null);}if(e.key==='Escape')setEditId(null);}}
                  onClick={e=>e.stopPropagation()}
                  style={{flex:1,background:'#1a1a28',border:'1px solid #3a3a60',borderRadius:3,color:'#c0c0e0',padding:'1px 4px',fontSize:10,fontFamily:'monospace',outline:'none'}}/>
              ):(
                <span onDoubleClick={e=>{e.stopPropagation();setEditId(obj.id);setEditVal(obj.label);}}
                  style={{flex:1,fontSize:10,fontFamily:'monospace',color:isSel?'#9090c0':'#2e2e50',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {obj.label}
                </span>
              )}
              <div style={{display:'flex',gap:2,opacity:isSel?1:0,transition:'opacity 0.1s',flexShrink:0}}>
                <IconBtn title={obj.visible?'Hide':'Show'} onClick={e=>{e.stopPropagation();dispatch(toggleVisibility(obj.id));}}>{obj.visible?'👁':'🚫'}</IconBtn>
                <IconBtn title={obj.locked?'Unlock':'Lock'} onClick={e=>{e.stopPropagation();dispatch(toggleLock(obj.id));}}>{obj.locked?'🔒':'🔓'}</IconBtn>
                <IconBtn title="Duplicate" onClick={e=>{e.stopPropagation();dispatch(duplicateObject(obj.id));}}>⧉</IconBtn>
                <IconBtn title="Delete" onClick={e=>{e.stopPropagation();dispatch(deleteObject(obj.id));}} red>✕</IconBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconBtn({children,onClick,title,red}:{children:React.ReactNode;onClick:(e:React.MouseEvent)=>void;title?:string;red?:boolean}) {
  return (
    <button onClick={onClick} title={title}
      style={{width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:2,border:'none',background:'transparent',cursor:'pointer',fontSize:9,color:red?'#FF4444':'#4a4a70',padding:0,lineHeight:1}}>
      {children}
    </button>
  );
}
