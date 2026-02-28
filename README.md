# 🎬 Manim Web Visual Editor

> Figma-style visual editor powered by [manim-web](https://github.com/maloyan/manim-web)

## ✅ What works

| Feature | Status |
|---|---|
| Add Circle / Square / Triangle | ✅ |
| Select, rename, hide, duplicate, delete objects | ✅ |
| Edit color, opacity, stroke, size, position via **leva** | ✅ |
| Add animation steps to objects | ✅ |
| Visual timeline with colored step blocks | ✅ |
| **▶ Play All** — real manim-web animations | ✅ |
| Step inspector (duration, type, target, MoveTo coords) | ✅ |
| Export valid Python Manim script | ✅ |

## 📁 File structure

```
src/
├── types/scene.ts                        ← SceneObject, AnimationStep types
├── store/editorStore.ts                  ← Redux Toolkit store
├── utils/pythonExporter.ts               ← Generates Python Manim code
├── components/
│   ├── canvas/ManimCanvas.tsx            ← WebGL canvas (THE KEY FILE)
│   ├── panel/ObjectsPanel.tsx            ← Left sidebar (layers)
│   ├── panel/PropertiesPanel.tsx         ← Right sidebar (uses leva)
│   └── timeline/TimelinePanel.tsx       ← Bottom bar (timeline + play)
├── App.tsx
├── main.tsx
└── index.css
```

## 🔑 Why animations work now

The critical insight from the manim-web docs:

```ts
// CORRECT — create a fresh scene, add objects, then play animations
const scene = new Scene(container, { width: 854, height: 480, backgroundColor: BLACK });
const circle = new Circle({ radius: 1, color: '#58C4DD', fillOpacity: 0.5 });
scene.add(circle);
await scene.play(new FadeIn(circle, { duration: 1 }));
await scene.play(new Transform(circle, square, { duration: 1.5 }));
```

**ManimCanvas has TWO modes:**

1. **PREVIEW** — Static view during editing. Calls `scene.clear()` then `scene.add()` for each visible object. No animations, updates live as you edit properties.

2. **PLAYBACK** — When Play is pressed, the preview scene is disposed, a **fresh** Scene is created, all mobjects are re-created, then each AnimationStep is executed with `await scene.play(...)`. After playback finishes, the preview scene is restored.

## 🚀 Setup

```bash
npm create vite@latest manim-editor -- --template react-ts
cd manim-editor
npm install manim-web @reduxjs/toolkit react-redux leva uuid @types/uuid
```

## 🎯 Supported animations

| Animation | Plays as |
|---|---|
| Create | `new Create(mob)` |
| FadeIn | `new FadeIn(mob)` |
| FadeOut | `new FadeOut(mob)` |
| Write | `new Write(mob)` |
| GrowFromCenter | `new GrowFromCenter(mob)` |
| Transform | `new Transform(mobA, mobB)` |
| Indicate | `new Indicate(mob)` |
| MoveTo | `mob.animate.moveTo([x,y,z])` |

## 📦 Dependencies used

| Package | Purpose |
|---|---|
| `manim-web` | WebGL animation engine |
| `@reduxjs/toolkit` + `react-redux` | State management |
| `leva` | Properties panel controls |
| `uuid` | Unique IDs for objects/steps |
