import { Scene, Circle, Square, Create, FadeIn, FadeOut, Write, GrowFromCenter, Transform, Indicate, BLACK, Shift } from 'manim-web';
import type { SceneObject, AnimationStep } from '../types/scene';

let MWTriangle: any = null;
let MWText: any = null;
let MWRotate: any = null;
let MWFlash: any = null;
let MWScaleInPlace: any = null;

(async () => {
  try {
    const mod = await import('manim-web') as any;
    MWTriangle = mod.Triangle ?? null;
    MWText = mod.Text ?? mod.Tex ?? null;
    MWRotate = mod.Rotate ?? null;
    MWFlash = mod.Flash ?? null;
    MWScaleInPlace = mod.ScaleInPlace ?? null;
  } catch(e) { console.warn('manim-web partial import:', e); }
})();

export const CANVAS_W = 854;
export const CANVAS_H = 480;
export const SCALE = 60;

export const mxToCanvas = (x: number) => CANVAS_W / 2 + x * SCALE;
export const myToCanvas = (y: number) => CANVAS_H / 2 - y * SCALE;
export const canvasToMx = (cx: number) => (cx - CANVAS_W / 2) / SCALE;
export const canvasToMy = (cy: number) => (CANVAS_H / 2 - cy) / SCALE;

export function buildMobject(obj: SceneObject): any {
  const { props, type } = obj;
  const base = { color: props.color, fillOpacity: props.fillOpacity, strokeWidth: props.strokeWidth ?? 2 };
  let mob: any;
  switch (type) {
    case 'circle':   mob = new Circle({ ...base, radius: props.radius ?? 1 }); break;
    case 'square':   mob = new Square({ ...base, sideLength: props.sideLength ?? 2 }); break;
    case 'triangle': mob = MWTriangle ? new MWTriangle({ ...base, sideLength: props.sideLength ?? 2 }) : new Square({ ...base, sideLength: props.sideLength ?? 2 }); break;
    case 'text':     mob = MWText ? new MWText(props.text ?? 'Text', { color: props.color }) : new Circle({ ...base, radius: 0.3 }); break;
    default:         mob = new Circle({ ...base, radius: 0.5 }); break;
  }
  try { mob.moveTo?.(props.position); } catch { /**/ }
  return mob;
}

export function createScene(container: HTMLElement): any {
  return new Scene(container, { width: CANVAS_W, height: CANVAS_H, backgroundColor: BLACK } as any);
}
export function disposeScene(scene: any) { try { scene?.dispose?.(); } catch { /**/ } }

export async function runStep(scene: any, step: AnimationStep, mobMap: Map<string,any>, onScene: Set<string>): Promise<void> {
  const mob = mobMap.get(step.objectId);
  if (!mob) return;
  const dur = step.duration;
  const ensure = (id: string) => { if (!onScene.has(id)) { const m = mobMap.get(id); if (m) { scene.add(m); onScene.add(id); } } };
  try {
    switch (step.animationType) {
      case 'Create':          ensure(step.objectId); await scene.play(new Create(mob,{duration:dur} as any)); break;
      case 'FadeIn':          ensure(step.objectId); await scene.play(new FadeIn(mob,{duration:dur} as any)); break;
      case 'FadeOut':         ensure(step.objectId); await scene.play(new FadeOut(mob,{duration:dur} as any)); onScene.delete(step.objectId); break;
      case 'Write':           ensure(step.objectId); await scene.play(new Write(mob,{duration:dur} as any)); break;
      case 'GrowFromCenter':  ensure(step.objectId); await scene.play(new GrowFromCenter(mob,{duration:dur} as any)); break;
      case 'Indicate':        ensure(step.objectId); await scene.play(new Indicate(mob,{duration:dur} as any)); break;
      case 'Flash':           ensure(step.objectId); await scene.play(MWFlash ? new MWFlash(mob,{duration:dur} as any) : new Indicate(mob,{duration:dur} as any)); break;
      case 'Transform':
      case 'ReplacementTransform': {
        const tgt = mobMap.get(step.params?.targetObjectId ?? '');
        ensure(step.objectId);
        if (tgt) { ensure(step.params!.targetObjectId!); await scene.play(new Transform(mob,tgt,{duration:dur} as any)); }
        else await scene.play(new Indicate(mob,{duration:dur} as any));
        break;
      }
      case 'MoveTo': {
        ensure(step.objectId);
        const pos = step.params?.targetPosition ?? [0,0,0];
        try {
          if (mob.animate?.moveTo) await scene.play(mob.animate.moveTo(pos) as any);
          else await scene.play(new Shift(mob, { direction: pos, duration: dur }));
        } catch { await scene.wait(dur); }
        break;
      }
      case 'Rotate': {
        ensure(step.objectId);
        if (MWRotate) await scene.play(new MWRotate(mob, step.params?.angle ?? Math.PI, {duration:dur} as any));
        else await scene.wait(dur);
        break;
      }
      case 'ScaleInPlace': {
        ensure(step.objectId);
        if (MWScaleInPlace) await scene.play(new MWScaleInPlace(mob, step.params?.scaleFactor ?? 2, {duration:dur} as any));
        else await scene.wait(dur);
        break;
      }
      default: await scene.wait(dur);
    }
  } catch(e) { console.error(`[runStep] ${step.animationType}:`, e); await new Promise(r => setTimeout(r, dur*1000)); }
}
