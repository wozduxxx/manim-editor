/**
 * SceneController
 * ───────────────
 * The bridge between Redux state (plain objects) and the live manim-web Scene.
 *
 * - Keeps a Map<objectId, mobject> so instances survive re-renders
 * - syncObjects()  → reflects the Redux object list into the scene (add / remove / update)
 * - playStep()     → calls the real manim-web animation API for one AnimationStep
 * - playAll()      → sequential playback of all steps
 *
 * Exposed via React context so ManimCanvas, TimelinePanel etc. share one scene.
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
  // Triangle may be absent in some builds — handled with a try/catch below
} from 'manim-web';

// Import animations — adjust if your build uses different entry points
import {
  Create,
  FadeIn,
  FadeOut,
  Write,
  GrowFromCenter,
  Transform,
  Indicate,
} from 'manim-web';

import { useDispatch } from 'react-redux';
import { setIsPlaying, setCurrentStep } from '../store/editorStore';
import type { AppDispatch } from '../store/editorStore';
import type { SceneObject, AnimationStep } from '../types/scene';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MobjectEntry {
  mob: any;   // the live manim-web mobject
  addedToScene: boolean;
}

interface SceneControllerHandle {
  /** Attach to a DOM container and boot the WebGL scene */
  init: (container: HTMLElement) => void;
  /** Tear down */
  dispose: () => void;
  /** Sync object list from Redux → scene (add/remove/update) */
  syncObjects: (objects: SceneObject[], selectedId: string | null) => void;
  /** Play a single AnimationStep */
  playStep: (step: AnimationStep, objects: SceneObject[]) => Promise<void>;
  /** Play all steps in order, updating Redux currentStep */
  playAll: (steps: AnimationStep[], objects: SceneObject[]) => Promise<void>;
  /** Stop any ongoing playback */
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

function createMobject(obj: SceneObject): any {
  const { props, type } = obj;
  const common = {
    color: props.color,
    fillOpacity: props.fillOpacity,
    strokeWidth: props.strokeWidth ?? 2,
  };

  switch (type) {
    case 'circle':
      return new Circle({ ...common, radius: props.radius ?? 1 } as any);
    case 'square':
      return new Square({ ...common, sideLength: props.sideLength ?? 2 } as any);
    case 'triangle': {
      // Triangle may not exist in all manim-web builds
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Triangle } = require('manim-web');
        return new Triangle({ ...common, sideLength: props.sideLength ?? 2 } as any);
      } catch {
        // Fallback: equilateral-ish polygon via Square with visual note
        return new Square({ ...common, sideLength: props.sideLength ?? 2 } as any);
      }
    }
    default:
      return new Circle({ ...common, radius: 1 } as any);
  }
}

/** Apply non-animation property changes to an existing mobject */
function applyProps(mob: any, obj: SceneObject) {
  try {
    mob.setColor?.(obj.props.color);
    mob.setFillOpacity?.(obj.props.fillOpacity);
    mob.setStrokeWidth?.(obj.props.strokeWidth ?? 2);
    const [x, y, z] = obj.props.position;
    if (x !== 0 || y !== 0 || z !== 0) {
      mob.moveTo?.([x, y, z]);
    }
  } catch {
    // silently ignore if the mobject API differs
  }
}

/** Highlight a selected mobject visually */
function highlightMob(mob: any, isSelected: boolean) {
  try {
    if (isSelected) {
      mob.setStrokeWidth?.(4);
      mob.setStrokeOpacity?.(1);
    }
  } catch { /* */ }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function SceneProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();

  const sceneRef = useRef<Scene | null>(null);
  const mobsRef = useRef<Map<string, MobjectEntry>>(new Map());
  const abortRef = useRef(false); // set to true on stop()

  // ── init ──────────────────────────────────────────────────────────────────

  const init = useCallback((container: HTMLElement) => {
    if (sceneRef.current) return; // already initialised
    const scene = new Scene(container);
    sceneRef.current = scene;
    (scene as any).start?.();
  }, []);

  // ── dispose ───────────────────────────────────────────────────────────────

  const dispose = useCallback(() => {
    abortRef.current = true;
    const scene = sceneRef.current;
    if (scene) {
      (scene as any).stop?.();
      (scene as any).dispose?.();
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
            try { (scene as any).remove?.(entry.mob); } catch { /* */ }
          }
          mobs.delete(id);
        }
      }

      // Add new / update existing
      for (const obj of objects) {
        if (!mobs.has(obj.id)) {
          // Brand new object
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
          // Update existing
          const entry = mobs.get(obj.id)!;
          applyProps(entry.mob, obj);

          if (obj.visible && !entry.addedToScene) {
            try { scene.add(entry.mob); entry.addedToScene = true; } catch { /* */ }
          } else if (!obj.visible && entry.addedToScene) {
            try { (scene as any).remove?.(entry.mob); entry.addedToScene = false; } catch { /* */ }
          }

          highlightMob(entry.mob, obj.id === selectedId);
        }
      }
    },
    []
  );

  // ── playStep ──────────────────────────────────────────────────────────────

  const playStep = useCallback(
    async (step: AnimationStep, objects: SceneObject[]) => {
      const scene = sceneRef.current;
      const mobs = mobsRef.current;
      if (!scene) return;

      const entry = mobs.get(step.objectId);
      if (!entry) return;
      const { mob } = entry;

      // Ensure the object is on scene before animating
      if (!entry.addedToScene) {
        try { scene.add(mob); entry.addedToScene = true; } catch { /* */ }
      }

      const dur = step.duration;

      try {
        switch (step.animationType) {
          case 'Create':
            await scene.play(new Create(mob, { runTime: dur } as any));
            break;
          case 'FadeIn':
            await scene.play(new FadeIn(mob, { runTime: dur } as any));
            break;
          case 'FadeOut':
            await scene.play(new FadeOut(mob, { runTime: dur } as any));
            entry.addedToScene = false;
            break;
          case 'Write':
            await scene.play(new Write(mob, { runTime: dur } as any));
            break;
          case 'GrowFromCenter':
            await scene.play(new GrowFromCenter(mob, { runTime: dur } as any));
            break;
          case 'Indicate':
            await scene.play(new Indicate(mob, { runTime: dur } as any));
            break;
          case 'Transform': {
            const targetId = step.params?.targetObjectId;
            const targetEntry = targetId ? mobs.get(targetId) : null;
            if (targetEntry) {
              // Ensure target is on scene
              if (!targetEntry.addedToScene) {
                try { scene.add(targetEntry.mob); targetEntry.addedToScene = true; } catch { /* */ }
              }
              await scene.play(new Transform(mob, targetEntry.mob, { runTime: dur } as any));
            } else {
              // No target: just fade as fallback
              await scene.play(new FadeIn(mob, { runTime: dur } as any));
            }
            break;
          }
          case 'MoveTo': {
            const [tx, ty, tz] = step.params?.targetPosition ?? [0, 0, 0];
            // Try different move APIs depending on manim-web version
            if ((scene as any).play && mob.animate) {
              await scene.play(mob.animate.moveTo([tx, ty, tz], { runTime: dur } as any));
            } else if ((mob as any).animateTo) {
              await (mob as any).animateTo([tx, ty, tz], dur);
            } else {
              // Fallback: instant move
              mob.moveTo?.([tx, ty, tz]);
              await new Promise((r) => setTimeout(r, dur * 1000));
            }
            break;
          }
          default:
            await new Promise((r) => setTimeout(r, dur * 1000));
        }
      } catch (e) {
        console.error(`playStep error [${step.animationType}]:`, e);
        // Graceful fallback: just wait
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

      // dispatch(resetPlayback());
    },
    [dispatch, playStep]
  );

  // ── stop ──────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    abortRef.current = true;
    // dispatch(resetPlayback());
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
