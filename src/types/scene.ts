export type ObjectType = 'circle' | 'square' | 'triangle';

export type AnimationType =
  | 'Create'
  | 'FadeIn'
  | 'FadeOut'
  | 'Write'
  | 'GrowFromCenter'
  | 'Transform'
  | 'Indicate'
  | 'MoveTo';

export interface SceneObject {
  id: string;
  type: ObjectType;
  label: string;
  visible: boolean;
  props: {
    color: string;
    fillOpacity: number;
    strokeWidth: number;
    radius?: number;
    sideLength?: number;
    position: [number, number, number];
  };
}

export interface AnimationStep {
  id: string;
  objectId: string;
  animationType: AnimationType;
  duration: number;
  order: number;
  params?: {
    targetObjectId?: string;
    targetPosition?: [number, number, number];
  };
}

export interface EditorState {
  objects: SceneObject[];
  animationSteps: AnimationStep[];
  selectedObjectId: string | null;
  selectedStepId: string | null;
  isPlaying: boolean;
  currentStep: number;
  scrubTime: number | null;
}
