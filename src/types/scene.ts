export type ObjectType = 'circle' | 'square' | 'triangle';

export interface SceneObject {
    id: string;
    type: ObjectType;
    props: {
        color: string;
        fillOpacity: number;
        radius?: number;
        sideLength?: number;
        position?: [number, number, number];
    };
}

export interface EditorState {
    objects: SceneObject[];
    selectedObjectId: string | null;
    isPlaying: boolean;
    currentStep: number;
}