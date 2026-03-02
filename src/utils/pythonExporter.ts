import type { SceneObject, AnimationStep } from '../types/scene';

function safeName(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g,'_').replace(/^(\d)/,'_$1');
}
function colorHex(hex: string): string {
  const known: Record<string,string> = {'#58C4DD':'BLUE','#FC6255':'RED','#83C167':'GREEN','#FFDD55':'YELLOW','#C77DBB':'PURPLE','#FF8C42':'ORANGE'};
  return known[hex.toUpperCase()] ?? `"${hex}"`;
}

export function exportToPython(objects: SceneObject[], steps: AnimationStep[]): string {
  const sorted = [...steps].sort((a,b) => a.startTime - b.startTime);
  const names = new Map(objects.map(o=>[o.id,safeName(o.label)]));
  const lines: string[] = ['from manim import *','','','class GeneratedScene(Scene):','    def construct(self):'];
  const needNp = objects.some(o=>o.props.position.some(v=>v!==0)) || sorted.some(s=>s.animationType==='MoveTo');
  if (needNp) lines.splice(1,0,'import numpy as np');
  if (objects.length>0) lines.push('        # Objects');
  for (const obj of objects) {
    const n=names.get(obj.id)!, {props}=obj;
    const c=colorHex(props.color), fo=props.fillOpacity.toFixed(2), sw=(props.strokeWidth??2).toFixed(1);
    const [x,y,z]=props.position;
    if (obj.type==='circle') lines.push(`        ${n} = Circle(radius=${(props.radius??1).toFixed(2)}, color=${c}, fill_opacity=${fo}, stroke_width=${sw})`);
    else if (obj.type==='square') lines.push(`        ${n} = Square(side_length=${(props.sideLength??2).toFixed(2)}, color=${c}, fill_opacity=${fo}, stroke_width=${sw})`);
    else if (obj.type==='triangle') lines.push(`        ${n} = Triangle(color=${c}, fill_opacity=${fo}, stroke_width=${sw})`);
    else if (obj.type==='text') lines.push(`        ${n} = Text(${JSON.stringify(props.text??'Text')}, color=${c})`);
    else if (obj.type==='line') lines.push(`        ${n} = Line(start=LEFT*${((props.width??3)/2).toFixed(2)}, end=RIGHT*${((props.width??3)/2).toFixed(2)}, color=${c})`);
    else if (obj.type==='arrow') lines.push(`        ${n} = Arrow(start=LEFT*${((props.width??3)/2).toFixed(2)}, end=RIGHT*${((props.width??3)/2).toFixed(2)}, color=${c})`);
    if (x!==0||y!==0||z!==0) lines.push(`        ${n}.move_to(np.array([${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}]))`);
  }
  if (sorted.length>0) { lines.push('','        # Animations'); }
  for (const step of sorted) {
    const n=names.get(step.objectId)?? 'unknown', dur=step.duration.toFixed(2);
    switch (step.animationType) {
      case 'Create': lines.push(`        self.play(Create(${n}), run_time=${dur})`); break;
      case 'FadeIn': lines.push(`        self.play(FadeIn(${n}), run_time=${dur})`); break;
      case 'FadeOut': lines.push(`        self.play(FadeOut(${n}), run_time=${dur})`); break;
      case 'Write': lines.push(`        self.play(Write(${n}), run_time=${dur})`); break;
      case 'GrowFromCenter': lines.push(`        self.play(GrowFromCenter(${n}), run_time=${dur})`); break;
      case 'Indicate': lines.push(`        self.play(Indicate(${n}), run_time=${dur})`); break;
      case 'Flash': lines.push(`        self.play(Flash(${n}), run_time=${dur})`); break;
      case 'Transform': case 'ReplacementTransform': {
        const tn=step.params?.targetObjectId?names.get(step.params.targetObjectId):null;
        if (tn) lines.push(`        self.play(${step.animationType}(${n},${tn}), run_time=${dur})`);
        break;
      }
      case 'MoveTo': {
        const p=step.params?.targetPosition;
        if (p) lines.push(`        self.play(${n}.animate.move_to(np.array([${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)}])), run_time=${dur})`);
        break;
      }
      case 'Rotate': lines.push(`        self.play(Rotate(${n}, angle=${(step.params?.angle??Math.PI).toFixed(4)}), run_time=${dur})`); break;
      case 'ScaleInPlace': lines.push(`        self.play(${n}.animate.scale(${(step.params?.scaleFactor??2).toFixed(2)}), run_time=${dur})`); break;
    }
  }
  if (sorted.length===0) lines.push('        self.wait(1)');
  else lines.push('        self.wait(0.5)');
  return lines.join('\n');
}

export function downloadPythonScript(objects: SceneObject[], steps: AnimationStep[], filename='animation.py'): void {
  const code = exportToPython(objects, steps);
  const blob = new Blob([code], {type:'text/x-python'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
