import { createSlice, configureStore, type PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import type { EditorState, CoreState, SceneObject, ObjectType, AnimationStep, AnimationType, ObjectProps } from '../types/scene';

let objectCounter = 0;
const COLORS = ['#58C4DD','#FC6255','#83C167','#FFDD55','#C77DBB','#FF8C42','#06D6A0','#EF476F'];

function snap(state: EditorState): CoreState {
  return { objects: JSON.parse(JSON.stringify(state.present.objects)), animationSteps: JSON.parse(JSON.stringify(state.present.animationSteps)) };
}
function pushHistory(state: EditorState) {
  state.past.push(snap(state));
  if (state.past.length > 60) state.past.shift();
  state.future = [];
}
function nextStart(steps: AnimationStep[], objectId: string): number {
  const s = steps.filter(s => s.objectId === objectId);
  return s.length === 0 ? 0 : Math.max(...s.map(s => s.startTime + s.duration));
}

const initialState: EditorState = {
  present: { objects: [], animationSteps: [] },
  past: [], future: [],
  selectedObjectId: null, selectedStepId: null,
  isPlaying: false, currentStep: -1, scrubTime: null,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    undo: (state) => {
      if (!state.past.length) return;
      state.future.unshift(snap(state));
      state.present = state.past.pop()!;
      state.selectedStepId = null;
    },
    redo: (state) => {
      if (!state.future.length) return;
      state.past.push(snap(state));
      state.present = state.future.shift()!;
      state.selectedStepId = null;
    },
    addObject: (state, action: PayloadAction<{ type: ObjectType }>) => {
      pushHistory(state);
      objectCounter++;
      const type = action.payload.type;
      const obj: SceneObject = {
        id: uuidv4(), type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}_${objectCounter}`,
        visible: true, locked: false,
        props: {
          color: COLORS[objectCounter % COLORS.length],
          fillOpacity: (type === 'line' || type === 'arrow') ? 1 : 0.5,
          strokeWidth: 2, position: [0, 0, 0], rotation: 0, scale: 1,
          ...(type === 'circle' && { radius: 1 }),
          ...(type === 'square' && { sideLength: 2 }),
          ...(type === 'triangle' && { sideLength: 2 }),
          ...((type === 'line' || type === 'arrow') && { width: 3 }),
          ...(type === 'text' && { text: 'Text', fontSize: 36 }),
        },
      };
      state.present.objects.push(obj);
      state.selectedObjectId = obj.id;
      state.selectedStepId = null;
    },
    updateObjectProps: (state, action: PayloadAction<{ id: string; props: Partial<ObjectProps> }>) => {
      pushHistory(state);
      const obj = state.present.objects.find(o => o.id === action.payload.id);
      if (obj) obj.props = { ...obj.props, ...action.payload.props };
    },
    dragObjectPosition: (state, action: PayloadAction<{ id: string; position: [number,number,number] }>) => {
      const obj = state.present.objects.find(o => o.id === action.payload.id);
      if (obj) obj.props.position = action.payload.position;
    },
    startDrag: (state, _action: PayloadAction<string>) => { pushHistory(state); },
    commitDrag: (_state, _action: PayloadAction<string>) => {},
    updateObjectLabel: (state, action: PayloadAction<{ id: string; label: string }>) => {
      pushHistory(state);
      const obj = state.present.objects.find(o => o.id === action.payload.id);
      if (obj) obj.label = action.payload.label;
    },
    toggleVisibility: (state, action: PayloadAction<string>) => {
      const obj = state.present.objects.find(o => o.id === action.payload);
      if (obj) obj.visible = !obj.visible;
    },
    toggleLock: (state, action: PayloadAction<string>) => {
      const obj = state.present.objects.find(o => o.id === action.payload);
      if (obj) obj.locked = !obj.locked;
    },
    selectObject: (state, action: PayloadAction<string|null>) => {
      state.selectedObjectId = action.payload;
      state.selectedStepId = null;
    },
    deleteObject: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      state.present.objects = state.present.objects.filter(o => o.id !== action.payload);
      state.present.animationSteps = state.present.animationSteps.filter(s => s.objectId !== action.payload && s.params?.targetObjectId !== action.payload);
      if (state.selectedObjectId === action.payload) state.selectedObjectId = null;
    },
    duplicateObject: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      objectCounter++;
      const src = state.present.objects.find(o => o.id === action.payload);
      if (!src) return;
      const clone: SceneObject = { ...src, id: uuidv4(), label: `${src.label}_copy`, locked: false, props: { ...src.props, position: [src.props.position[0]+0.4, src.props.position[1]-0.4, 0] } };
      state.present.objects.push(clone);
      state.selectedObjectId = clone.id;
    },
    addAnimationStep: (state, action: PayloadAction<{ objectId: string; animationType: AnimationType }>) => {
      pushHistory(state);
      const startTime = nextStart(state.present.animationSteps, action.payload.objectId);
      const step: AnimationStep = { id: uuidv4(), objectId: action.payload.objectId, animationType: action.payload.animationType, duration: 1, startTime };
      state.present.animationSteps.push(step);
      state.selectedStepId = step.id;
    },
    updateAnimationStep: (state, action: PayloadAction<{ id: string; changes: Partial<AnimationStep> }>) => {
      pushHistory(state);
      const step = state.present.animationSteps.find(s => s.id === action.payload.id);
      if (step) Object.assign(step, action.payload.changes);
    },
    dragStepStartTime: (state, action: PayloadAction<{ id: string; startTime: number }>) => {
      const step = state.present.animationSteps.find(s => s.id === action.payload.id);
      if (step) step.startTime = Math.max(0, action.payload.startTime);
    },
    resizeStepDuration: (state, action: PayloadAction<{ id: string; duration: number }>) => {
      const step = state.present.animationSteps.find(s => s.id === action.payload.id);
      if (step) step.duration = Math.max(0.1, action.payload.duration);
    },
    startStepDrag: (state) => { pushHistory(state); },
    deleteAnimationStep: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      state.present.animationSteps = state.present.animationSteps.filter(s => s.id !== action.payload);
      if (state.selectedStepId === action.payload) state.selectedStepId = null;
    },
    selectStep: (state, action: PayloadAction<string>) => { state.selectedStepId = action.payload; },
    setIsPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    setCurrentStep: (state, action: PayloadAction<number>) => { state.currentStep = action.payload; },
    stopPlayback: (state) => { state.isPlaying = false; state.currentStep = -1; },
    setScrubTime: (state, action: PayloadAction<number|null>) => { state.scrubTime = action.payload; },
  },
});

export const {
  undo, redo,
  addObject, updateObjectProps, dragObjectPosition, startDrag, commitDrag,
  updateObjectLabel, toggleVisibility, toggleLock,
  selectObject, deleteObject, duplicateObject,
  addAnimationStep, updateAnimationStep, dragStepStartTime, resizeStepDuration,
  startStepDrag, deleteAnimationStep, selectStep,
  setIsPlaying, setCurrentStep, stopPlayback, setScrubTime,
} = editorSlice.actions;

export const store = configureStore({ reducer: { editor: editorSlice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
