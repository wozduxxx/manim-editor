export type ObjectType = 'circle' | 'square' | 'triangle' | 'text' | 'line' | 'arrow';
export type AnimationType = 'Create'|'FadeIn'|'FadeOut'|'Write'|'GrowFromCenter'|'Transform'|'ReplacementTransform'|'Indicate'|'MoveTo'|'Rotate'|'ScaleInPlace'|'Flash';

export interface SceneObject {
  id: string; type: ObjectType; label: string; visible: boolean; locked: boolean; props: ObjectProps;
}
export interface ObjectProps {
  color: string; fillOpacity: number; strokeWidth: number; position: [number,number,number];
  radius?: number; sideLength?: number; width?: number; text?: string; fontSize?: number; rotation?: number; scale?: number;
}
export interface AnimationStep {
  id: string; objectId: string; animationType: AnimationType; duration: number; startTime: number;
  params?: { targetObjectId?: string; targetPosition?: [number,number,number]; angle?: number; scaleFactor?: number; };
}
export interface CoreState { objects: SceneObject[]; animationSteps: AnimationStep[]; }
export interface EditorState {
  present: CoreState; past: CoreState[]; future: CoreState[];
  selectedObjectId: string|null; selectedStepId: string|null;
  isPlaying: boolean; currentStep: number; scrubTime: number|null;
}
