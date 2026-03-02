/**
 * pythonExporter.ts — генератор Python-скрипта из Redux state
 *
 * Совместим с py2ts паттерном из manim-web:
 * py2ts конвертирует Python → TS, мы делаем обратное TS → Python
 *
 * Паттерны из Player.ts/RecordingScene:
 * - scene.play(new Create(mob)) → self.play(Create(mob))
 * - scene.wait(0.5) → self.wait(0.5)
 * - Параллельные анимации: scene.play(anim1, anim2) → self.play(anim1, anim2)
 */

import type { SceneObject, AnimationStep } from '../types/scene';

function safeName(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function colorHex(hex: string): string {
  // Manim принимает ManimColor или hex строку напрямую
  const known: Record<string,string> = {
    '#58C4DD':'BLUE','#FC6255':'RED','#83C167':'GREEN',
    '#FFFF00':'YELLOW','#9370DB':'PURPLE','#FF8C00':'ORANGE',
    '#FFFFFF':'WHITE','#000000':'BLACK',
  };
  return known[hex.toUpperCase()] ?? `"${hex}"`;
}

export function exportToPython(
    objects: SceneObject[],
    steps: AnimationStep[],
): string {
  const sorted = [...steps].sort((a,b) => a.order - b.order);
  const names = new Map(objects.map(o => [o.id, safeName(o.label)]));

  const lines: string[] = [
    'from manim import *',
    '',
    '',
    'class GeneratedScene(Scene):',
    '    def construct(self):',
  ];

  // Объекты
  if (objects.length > 0) lines.push('        # ── Objects ──────────────────────────────────────');
  for (const obj of objects) {
    const name = names.get(obj.id)!;
    const { props } = obj;
    const color = colorHex(props.color);
    const fillOp = props.fillOpacity.toFixed(2);
    const sw = (props.strokeWidth ?? 2).toFixed(1);
    const [x, y, z] = props.position;

    let ctor = '';
    if (obj.type === 'circle') {
      ctor = `Circle(radius=${(props.radius??1).toFixed(2)}, color=${color}, fill_opacity=${fillOp}, stroke_width=${sw})`;
    } else if (obj.type === 'square') {
      ctor = `Square(side_length=${(props.sideLength??2).toFixed(2)}, color=${color}, fill_opacity=${fillOp}, stroke_width=${sw})`;
    } else {
      ctor = `Triangle(color=${color}, fill_opacity=${fillOp}, stroke_width=${sw})`;
      if (props.sideLength && props.sideLength !== 2) {
        lines.push(`        ${name} = ${ctor}`);
        lines.push(`        ${name}.scale(${(props.sideLength/2).toFixed(3)})`);
        if (x !== 0 || y !== 0) lines.push(`        ${name}.move_to(np.array([${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]))`);
        lines.push('');
        continue;
      }
    }
    lines.push(`        ${name} = ${ctor}`);
    if (x !== 0 || y !== 0 || z !== 0) {
      lines.push(`        ${name}.move_to(np.array([${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]))`);
    }
  }

  // Анимации — паттерн из Player/RecordingScene
  if (sorted.length > 0) {
    lines.push('');
    lines.push('        # ── Animation sequence ──────────────────────────────');
    lines.push('        # Generated from Player.sequence() pattern');
  }

  for (const step of sorted) {
    const name = names.get(step.objectId) ?? 'unknown';
    const dur = step.duration.toFixed(2);

    switch (step.animationType) {
      case 'Create':
        lines.push(`        self.play(Create(${name}), run_time=${dur})`);
        break;
      case 'FadeIn':
        lines.push(`        self.play(FadeIn(${name}), run_time=${dur})`);
        break;
      case 'FadeOut':
        lines.push(`        self.play(FadeOut(${name}), run_time=${dur})`);
        break;
      case 'Write':
        lines.push(`        self.play(Write(${name}), run_time=${dur})`);
        break;
      case 'GrowFromCenter':
        lines.push(`        self.play(GrowFromCenter(${name}), run_time=${dur})`);
        break;
      case 'Indicate':
        lines.push(`        self.play(Indicate(${name}), run_time=${dur})`);
        break;
      case 'Transform': {
        const tgtName = step.params?.targetObjectId
            ? (names.get(step.params.targetObjectId) ?? 'unknown')
            : null;
        if (tgtName) {
          lines.push(`        self.play(Transform(${name}, ${tgtName}.copy()), run_time=${dur})`);
        } else {
          lines.push(`        self.play(Indicate(${name}), run_time=${dur})  # Transform: target not found`);
        }
        break;
      }
      case 'MoveTo': {
        if (step.params?.targetPosition) {
          const [tx,ty,tz] = step.params.targetPosition;
          lines.push(`        self.play(${name}.animate.move_to(np.array([${tx.toFixed(3)}, ${ty.toFixed(3)}, ${tz.toFixed(3)}])), run_time=${dur})`);
        }
        break;
      }
      default:
        lines.push(`        self.play(FadeIn(${name}), run_time=${dur})  # unknown: ${step.animationType}`);
    }
  }

  if (sorted.length === 0) {
    lines.push('        self.wait(1)');
  } else {
    lines.push('        self.wait(0.5)');
  }

  // Добавляем numpy если есть позиции или MoveTo
  const needsNumpy = objects.some(o => o.props.position.some(v=>v!==0))
      || sorted.some(s => s.animationType === 'MoveTo');
  if (needsNumpy) {
    lines.splice(1, 0, 'import numpy as np');
  }

  return lines.join('\n');
}

export function downloadPythonScript(
    objects: SceneObject[],
    steps: AnimationStep[],
    filename = 'animation.py',
): void {
  const code = exportToPython(objects, steps);
  const blob = new Blob([code], { type: 'text/x-python' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}