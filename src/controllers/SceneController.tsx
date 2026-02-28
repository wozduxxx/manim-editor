/**
 * SceneController
 * ───────────────
 * The bridge between Redux state (plain objects) and the live manim-web Scene.
 */

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import {
  Scene,
  Circle,
  Square,
  Triangle,
  Mobject,
  Create,
  FadeIn,
  FadeOut,
  Write,
  GrowFromCenter,
  Transform,
  Indicate,
  type AnimationConfig,
  type Point3D, Dot,
} from 'manim-web';

import { useDispatch } from 'react-redux';
import { setIsPlaying, setCurrentStep } from '../store/editorStore';
import type { AppDispatch } from '../store/editorStore';
import type { SceneObject, AnimationStep } from '../types/scene';
import {ApplyMethod, MoveAlongPath, MoveToTarget, Shift} from "manim-web/dist/animation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MobjectEntry {
  mob: Mobject;
  addedToScene: boolean;
}

interface SceneControllerHandle {
  init: (container: HTMLElement) => void;
  dispose: () => void;
  syncObjects: (objects: SceneObject[], selectedId: string | null) => void;
  playStep: (step: AnimationStep, objects: SceneObject[]) => Promise<void>;
  playAll: (steps: AnimationStep[], objects: SceneObject[]) => Promise<void>;
  stop: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SceneControllerContext = createContext<SceneControllerHandle | null>(null);

export function useSceneController(): SceneControllerHandle {
  const ctx = useContext(SceneControllerContext);
  if (!ctx) throw new Error('useSceneController must be used inside SceneProvider');
  return ctx;
}

// ─── Mobject factory ─────────────────────────────────────────────────────────

function createMobject(obj: SceneObject): Mobject {
  const { props, type } = obj;
  const common = {
    color: props.color,
    fillOpacity: props.fillOpacity,
    strokeWidth: props.strokeWidth ?? 2,
  };

  switch (type) {
    case 'circle':
      return new Circle({ ...common, radius: props.radius ?? 1 });
    case 'square':
      return new Square({ ...common, sideLength: props.sideLength ?? 2 });
    case 'triangle':
      return new Triangle({ ...common, sideLength: props.sideLength ?? 2 });
    default:
      return new Circle({ ...common, radius: 1 });
  }
}

/** Apply non-animation property changes to an existing mobject */
function applyProps(mob: Mobject, obj: SceneObject): void {
  try {
    mob.setColor(obj.props.color);
    mob.setFillOpacity(obj.props.fillOpacity);
    mob.setStrokeWidth(obj.props.strokeWidth ?? 2);
    const [x, y, z] = obj.props.position;
    if (x !== 0 || y !== 0 || z !== 0) {
      mob.moveTo([x, y, z] as Point3D);
    }
  } catch {
    // silently ignore if the mobject API differs
  }
}

/** Highlight a selected mobject visually */
function highlightMob(mob: Mobject, isSelected: boolean): void {
  try {
    if (isSelected) {
      mob.setStrokeWidth(4);
      mob.setStrokeOpacity(1);
    }
  } catch { /* */ }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function SceneProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();

  const sceneRef = useRef<Scene | null>(null);
  const mobsRef = useRef<Map<string, MobjectEntry>>(new Map());
  const abortRef = useRef(false);

  // ── init ──────────────────────────────────────────────────────────────────

  const init = useCallback((container: HTMLElement) => {
    if (sceneRef.current) return;
    const scene = new Scene(container);
    sceneRef.current = scene;
    scene.start();
  }, []);

  // ── dispose ───────────────────────────────────────────────────────────────

  const dispose = useCallback(() => {
    abortRef.current = true;
    const scene = sceneRef.current;
    if (scene) {
      scene.stop();
      scene.dispose();
      sceneRef.current = null;
    }
    mobsRef.current.clear();
  }, []);

  // ── syncObjects ───────────────────────────────────────────────────────────

  const syncObjects = useCallback(
      (objects: SceneObject[], selectedId: string | null) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const mobs = mobsRef.current;
        const currentIds = new Set(objects.map((o) => o.id));

        // Remove deleted objects
        for (const [id, entry] of mobs) {
          if (!currentIds.has(id)) {
            if (entry.addedToScene) {
              try { scene.remove(entry.mob); } catch { /* */ }
            }
            mobs.delete(id);
          }
        }

        // Add new / update existing
        for (const obj of objects) {
          if (!mobs.has(obj.id)) {
            const mob = createMobject(obj);
            mobs.set(obj.id, { mob, addedToScene: false });
            if (obj.visible) {
              try {
                applyProps(mob, obj);
                scene.add(mob);
                mobs.get(obj.id)!.addedToScene = true;
              } catch { /* */ }
            }
          } else {
            const entry = mobs.get(obj.id)!;
            applyProps(entry.mob, obj);

            if (obj.visible && !entry.addedToScene) {
              try { scene.add(entry.mob); entry.addedToScene = true; } catch { /* */ }
            } else if (!obj.visible && entry.addedToScene) {
              try { scene.remove(entry.mob); entry.addedToScene = false; } catch { /* */ }
            }

            highlightMob(entry.mob, obj.id === selectedId);
          }
        }
      },
      []
  );

  // ── playStep ──────────────────────────────────────────────────────────────

  const playStep = useCallback(
      async (step: AnimationStep) => {
        const scene = sceneRef.current;
        const mobs = mobsRef.current;
        if (!scene) return;

        const entry = mobs.get(step.objectId);
        if (!entry) return;
        const { mob } = entry;

        if (!entry.addedToScene) {
          try { scene.add(mob); entry.addedToScene = true; } catch { /* */ }
        }

        const dur = step.duration;
        const config: AnimationConfig = { runTime: dur };

        try {
          switch (step.animationType) {
            case 'Create':
              await scene.play(new Create(mob, config));
              break;
            case 'FadeIn':
              await scene.play(new FadeIn(mob, config));
              break;
            case 'FadeOut':
              await scene.play(new FadeOut(mob, config));
              entry.addedToScene = false;
              break;
            case 'Write':
              await scene.play(new Write(mob, config));
              break;
            case 'GrowFromCenter':
              await scene.play(new GrowFromCenter(mob, config));
              break;
            case 'Indicate':
              await scene.play(new Indicate(mob, config));
              break;
            case 'Transform': {
              const targetId = step.params?.targetObjectId;
              const targetEntry = targetId ? mobs.get(targetId) : null;
              if (targetEntry) {
                if (!targetEntry.addedToScene) {
                  try { scene.add(targetEntry.mob); targetEntry.addedToScene = true; } catch { /* */ }
                }
                await scene.play(new Transform(mob, targetEntry.mob, config));
              } else {
                await scene.play(new FadeIn(mob, config));
              }
              break;
            }
            case 'MoveTo': {
              const [tx, ty, tz] = step.params?.targetPosition ?? [0, 0, 0];
              // const targetPoint: Point3D = [tx, ty, tz];
              const currentPos = mob.getCenter() as Point3D;

              const shiftVector: Point3D = [
                tx - currentPos[0],
                ty - currentPos[1],
                tz - currentPos[2],
              ];

              await scene.play(new Shift(mob, shiftVector));
              break;
            }
            default:
              await new Promise((r) => setTimeout(r, dur * 1000));
          }
        } catch (e) {
          console.error(`playStep error [${step.animationType}]:`, e);
          await new Promise((r) => setTimeout(r, dur * 1000));
        }
      },
      []
  );

  // ── playAll ───────────────────────────────────────────────────────────────

  const playAll = useCallback(
      async (steps: AnimationStep[], objects: SceneObject[]) => {
        abortRef.current = false;
        const sorted = [...steps].sort((a, b) => a.order - b.order);

        dispatch(setIsPlaying(true));

        for (let i = 0; i < sorted.length; i++) {
          if (abortRef.current) break;
          dispatch(setCurrentStep(i));
          await playStep(sorted[i], objects);
          if (abortRef.current) break;
        }
      },
      [dispatch, playStep]
  );

  // ── stop ──────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    abortRef.current = true;
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────

  const handle: SceneControllerHandle = {
    init,
    dispose,
    syncObjects,
    playStep,
    playAll,
    stop,
  };

  return (
      <SceneControllerContext.Provider value={handle}>
        {children}
      </SceneControllerContext.Provider>
  );
}