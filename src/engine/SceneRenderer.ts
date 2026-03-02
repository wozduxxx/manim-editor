import type { SceneObject, AnimationStep } from '../types/scene';
import { CANVAS_W, CANVAS_H, SCALE, mxToCanvas, myToCanvas } from './ManimAdapter';

export function hexToRgba(hex: string, a: number): string {
  if (!hex || hex.length < 7) return `rgba(128,128,128,${a})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

export function getObjectBounds(obj: SceneObject) {
  const [ox,oy] = obj.props.position;
  const cx = mxToCanvas(ox), cy = myToCanvas(oy);
  if (obj.type === 'circle') { const r = (obj.props.radius??1)*SCALE; return {cx,cy,w:r*2,h:r*2,hw:r,hh:r}; }
  const s = (obj.props.sideLength??2)*SCALE/2;
  return {cx,cy,w:s*2,h:s*2,hw:s,hh:s};
}

export function hitTestObject(obj: SceneObject, cx: number, cy: number): boolean {
  const [ox,oy] = obj.props.position;
  const x = mxToCanvas(ox), y = myToCanvas(oy);
  if (obj.type === 'circle') return Math.hypot(cx-x,cy-y) <= (obj.props.radius??1)*SCALE+8;
  const s = (obj.props.sideLength??2)*SCALE/2+8;
  return cx>=x-s && cx<=x+s && cy>=y-s && cy<=y+s;
}

export function getHandlePositions(obj: SceneObject): [number,number][] {
  const [ox,oy] = obj.props.position;
  const x = mxToCanvas(ox), y = myToCanvas(oy);
  const r = obj.type==='circle' ? (obj.props.radius??1)*SCALE+10 : (obj.props.sideLength??2)*SCALE/2+10;
  return [[x-r,y-r],[x,y-r],[x+r,y-r],[x+r,y],[x+r,y+r],[x,y+r],[x-r,y+r],[x-r,y]];
}

export function interpolateObjectAtTime(obj: SceneObject, steps: AnimationStep[], t: number): SceneObject {
  if (t<=0) return obj;
  let result = {...obj, props:{...obj.props}};
  for (const step of steps.filter(s=>s.objectId===obj.id).sort((a,b)=>a.startTime-b.startTime)) {
    const {startTime,duration} = step;
    if (t<startTime) continue;
    const p = Math.min(1,(t-startTime)/duration);
    if (step.animationType==='MoveTo' && step.params?.targetPosition) {
      const [tx,ty,tz]=step.params.targetPosition, [sx,sy,sz]=result.props.position;
      result={...result,props:{...result.props,position:[sx+(tx-sx)*p,sy+(ty-sy)*p,sz+(tz-sz)*p]}};
    }
    if (step.animationType==='FadeOut') result={...result,props:{...result.props,fillOpacity:result.props.fillOpacity*(1-p)}};
    if (step.animationType==='FadeIn'||step.animationType==='Create') result={...result,props:{...result.props,fillOpacity:obj.props.fillOpacity*p}};
  }
  return result;
}

function drawObj(ctx: CanvasRenderingContext2D, obj: SceneObject, selected: boolean) {
  const {props,type} = obj;
  const [ox,oy]=props.position, cx=mxToCanvas(ox), cy=myToCanvas(oy), sw=props.strokeWidth??2;
  ctx.save();
  ctx.strokeStyle = selected ? '#ffffff' : props.color;
  ctx.lineWidth = selected ? sw+1.5 : sw;
  ctx.fillStyle = hexToRgba(props.color, props.fillOpacity);
  switch(type) {
    case 'circle': { const r=(props.radius??1)*SCALE; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); ctx.stroke(); break; }
    case 'square': { const s=(props.sideLength??2)*SCALE; ctx.beginPath(); ctx.rect(cx-s/2,cy-s/2,s,s); ctx.fill(); ctx.stroke(); break; }
    case 'triangle': { const s=(props.sideLength??2)*SCALE,h=s*Math.sqrt(3)/2; ctx.beginPath(); ctx.moveTo(cx,cy-h*2/3); ctx.lineTo(cx+s/2,cy+h/3); ctx.lineTo(cx-s/2,cy+h/3); ctx.closePath(); ctx.fill(); ctx.stroke(); break; }
    case 'text': { const fs=(props.fontSize??36)*0.4; ctx.font=`${fs}px JetBrains Mono,monospace`; ctx.fillStyle=props.color; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(props.text??'Text',cx,cy); break; }
    case 'line': { const w=(props.width??3)*SCALE; ctx.beginPath(); ctx.moveTo(cx-w/2,cy); ctx.lineTo(cx+w/2,cy); ctx.stroke(); break; }
    case 'arrow': {
      const w=(props.width??3)*SCALE, ah=12;
      ctx.beginPath(); ctx.moveTo(cx-w/2,cy); ctx.lineTo(cx+w/2-ah,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+w/2,cy); ctx.lineTo(cx+w/2-ah,cy-ah/2); ctx.lineTo(cx+w/2-ah,cy+ah/2); ctx.closePath(); ctx.fillStyle=props.color; ctx.fill();
      break;
    }
  }
  // label
  const labelY = cy - getObjectBounds(obj).hh - 8;
  ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillStyle = selected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)';
  ctx.fillText(obj.label, cx, labelY);
  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, obj: SceneObject) {
  const b = getObjectBounds(obj);
  ctx.save();
  ctx.strokeStyle='rgba(88,196,221,0.75)'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
  if (obj.type==='circle') { ctx.beginPath(); ctx.arc(b.cx,b.cy,b.hw+8,0,Math.PI*2); ctx.stroke(); }
  else ctx.strokeRect(b.cx-b.hw-8,b.cy-b.hh-8,b.w+16,b.h+16);
  ctx.setLineDash([]);
  for(const [hx,hy] of getHandlePositions(obj)) {
    ctx.fillStyle='#0d0d18'; ctx.strokeStyle='rgba(88,196,221,0.9)'; ctx.lineWidth=1.5;
    ctx.fillRect(hx-4,hy-4,8,8); ctx.strokeRect(hx-4,hy-4,8,8);
  }
  ctx.restore();
}

export function renderPreviewFrame(canvas: HTMLCanvasElement, objects: SceneObject[], steps: AnimationStep[], selectedId: string|null, previewTime: number) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle='#030712'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.strokeStyle='rgba(255,255,255,0.018)'; ctx.lineWidth=1;
  for(let x=CANVAS_W/2%SCALE;x<CANVAS_W;x+=SCALE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CANVAS_H);ctx.stroke();}
  for(let y=CANVAS_H/2%SCALE;y<CANVAS_H;y+=SCALE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CANVAS_W,y);ctx.stroke();}
  ctx.strokeStyle='rgba(255,255,255,0.055)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(CANVAS_W/2,0);ctx.lineTo(CANVAS_W/2,CANVAS_H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,CANVAS_H/2);ctx.lineTo(CANVAS_W,CANVAS_H/2);ctx.stroke();
  const vis = objects.filter(o=>o.visible);
  for(const obj of vis.filter(o=>o.id!==selectedId)) drawObj(ctx, previewTime>0?interpolateObjectAtTime(obj,steps,previewTime):obj, false);
  for(const obj of vis.filter(o=>o.id===selectedId)) { drawObj(ctx, previewTime>0?interpolateObjectAtTime(obj,steps,previewTime):obj, true); drawHandles(ctx,obj); }
}
