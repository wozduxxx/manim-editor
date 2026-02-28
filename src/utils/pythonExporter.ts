import type { SceneObject, AnimationStep } from '../types/scene';

function varName(obj: SceneObject) {
  return obj.label.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}

export function exportToPython(objects: SceneObject[], steps: AnimationStep[]): string {
  const visible = objects.filter(o => o.visible);
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  const objLines = visible.map(obj => {
    const n = varName(obj);
    const c = `"${obj.props.color}"`;
    const op = obj.props.fillOpacity;
    const sw = obj.props.strokeWidth ?? 2;
    let decl = '';
    switch (obj.type) {
      case 'circle':   decl = `Circle(radius=${obj.props.radius ?? 1}, color=${c}, fill_opacity=${op}, stroke_width=${sw})`; break;
      case 'square':   decl = `Square(side_length=${obj.props.sideLength ?? 2}, color=${c}, fill_opacity=${op}, stroke_width=${sw})`; break;
      case 'triangle': decl = `Triangle(color=${c}, fill_opacity=${op}, stroke_width=${sw})`; break;
    }
    const [x, y, z] = obj.props.position;
    const mov = (x !== 0 || y !== 0 || z !== 0) ? `\n        ${n}.move_to(np.array([${x}, ${y}, ${z}]))` : '';
    return `        ${n} = ${decl}${mov}`;
  });

  const animLines = sorted
    .filter(s => visible.some(o => o.id === s.objectId))
    .map(step => {
      const obj = visible.find(o => o.id === step.objectId)!;
      const n = varName(obj);
      const t = step.duration;
      switch (step.animationType) {
        case 'Create':         return `        self.play(Create(${n}), run_time=${t})`;
        case 'FadeIn':         return `        self.play(FadeIn(${n}), run_time=${t})`;
        case 'FadeOut':        return `        self.play(FadeOut(${n}), run_time=${t})`;
        case 'Write':          return `        self.play(Write(${n}), run_time=${t})`;
        case 'GrowFromCenter': return `        self.play(GrowFromCenter(${n}), run_time=${t})`;
        case 'Indicate':       return `        self.play(Indicate(${n}), run_time=${t})`;
        case 'Transform': {
          const tgt = visible.find(o => o.id === step.params?.targetObjectId);
          return tgt
            ? `        self.play(Transform(${n}, ${varName(tgt)}), run_time=${t})`
            : `        self.play(FadeIn(${n}), run_time=${t})  # Transform target missing`;
        }
        case 'MoveTo': {
          const [tx, ty, tz] = step.params?.targetPosition ?? [0, 0, 0];
          return `        self.play(${n}.animate.move_to(np.array([${tx}, ${ty}, ${tz}])), run_time=${t})`;
        }
        default: return `        self.wait(${t})`;
      }
    });

  return [
    'from manim import *',
    'import numpy as np',
    '',
    '',
    'class GeneratedScene(Scene):',
    '    def construct(self):',
    '        # Objects',
    ...objLines,
    '',
    '        # Add to scene',
    ...visible.map(o => `        self.add(${varName(o)})`),
    '',
    '        # Animations',
    ...(animLines.length ? animLines : ['        self.wait(1)']),
    '        self.wait(0.5)',
  ].join('\n');
}

export function downloadPython(objects: SceneObject[], steps: AnimationStep[]) {
  const code = exportToPython(objects, steps);
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scene.py';
  a.click();
  URL.revokeObjectURL(url);
}
