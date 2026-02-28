import { createSlice, configureStore, type PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import type { EditorState, SceneObject, ObjectType, AnimationStep, AnimationType } from '../types/scene';

let objectCounter = 0;
const COLORS = ['#58C4DD', '#FC6255', '#83C167', '#FFDD55', '#C77DBB', '#FF8C42'];

const initialState: EditorState = {
  objects: [],
  animationSteps: [],
  selectedObjectId: null,
  selectedStepId: null,
  isPlaying: false,
  currentStep: -1,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    addObject: (state, action: PayloadAction<{ type: ObjectType }>) => {
      objectCounter++;
      const type = action.payload.type;
      const obj: SceneObject = {
        id: uuidv4(),
        type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}_${objectCounter}`,
        visible: true,
        props: {
          color: COLORS[objectCounter % COLORS.length],
          fillOpacity: 0.5,
          strokeWidth: 2,
          position: [0, 0, 0],
          ...(type === 'circle' && { radius: 1 }),
          ...((type === 'square' || type === 'triangle') && { sideLength: 2 }),
        },
      };
      state.objects.push(obj);
      state.selectedObjectId = obj.id;
      state.selectedStepId = null;
    },

    updateObjectProps: (state, action: PayloadAction<{ id: string; props: Partial<SceneObject['props']> }>) => {
      const obj = state.objects.find(o => o.id === action.payload.id);
      if (obj) obj.props = { ...obj.props, ...action.payload.props };
    },

    updateObjectLabel: (state, action: PayloadAction<{ id: string; label: string }>) => {
      const obj = state.objects.find(o => o.id === action.payload.id);
      if (obj) obj.label = action.payload.label;
    },

    toggleVisibility: (state, action: PayloadAction<string>) => {
      const obj = state.objects.find(o => o.id === action.payload);
      if (obj) obj.visible = !obj.visible;
    },

    selectObject: (state, action: PayloadAction<string | null>) => {
      state.selectedObjectId = action.payload;
      state.selectedStepId = null;
    },

    deleteObject: (state, action: PayloadAction<string>) => {
      state.objects = state.objects.filter(o => o.id !== action.payload);
      state.animationSteps = state.animationSteps.filter(
        s => s.objectId !== action.payload && s.params?.targetObjectId !== action.payload
      );
      if (state.selectedObjectId === action.payload) state.selectedObjectId = null;
    },

    duplicateObject: (state, action: PayloadAction<string>) => {
      objectCounter++;
      const src = state.objects.find(o => o.id === action.payload);
      if (!src) return;
      const clone: SceneObject = {
        ...src,
        id: uuidv4(),
        label: `${src.label}_2`,
        props: { ...src.props, position: [src.props.position[0] + 0.5, src.props.position[1] - 0.5, 0] },
      };
      state.objects.push(clone);
      state.selectedObjectId = clone.id;
    },

    addAnimationStep: (state, action: PayloadAction<{ objectId: string; animationType: AnimationType }>) => {
      const maxOrder = state.animationSteps.reduce((m, s) => Math.max(m, s.order), -1);
      const step: AnimationStep = {
        id: uuidv4(),
        objectId: action.payload.objectId,
        animationType: action.payload.animationType,
        duration: 1,
        order: maxOrder + 1,
      };
      state.animationSteps.push(step);
      state.selectedStepId = step.id;
      state.selectedObjectId = null;
    },

    updateAnimationStep: (state, action: PayloadAction<{ id: string; changes: Partial<Omit<AnimationStep, 'id'>> }>) => {
      const step = state.animationSteps.find(s => s.id === action.payload.id);
      if (step) Object.assign(step, action.payload.changes);
    },

    deleteAnimationStep: (state, action: PayloadAction<string>) => {
      state.animationSteps = state.animationSteps.filter(s => s.id !== action.payload);
      if (state.selectedStepId === action.payload) state.selectedStepId = null;
    },

    selectStep: (state, action: PayloadAction<string | null>) => {
      state.selectedStepId = action.payload;
      state.selectedObjectId = null;
    },

    setIsPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    setCurrentStep: (state, action: PayloadAction<number>) => { state.currentStep = action.payload; },
    stopPlayback: (state) => { state.isPlaying = false; state.currentStep = -1; },
  },
});

export const {
  addObject, updateObjectProps, updateObjectLabel, toggleVisibility,
  selectObject, deleteObject, duplicateObject,
  addAnimationStep, updateAnimationStep, deleteAnimationStep, selectStep,
  setIsPlaying, setCurrentStep, stopPlayback,
} = editorSlice.actions;

export const store = configureStore({ reducer: { editor: editorSlice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
