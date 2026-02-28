import { createSlice, configureStore, type PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import type {EditorState, SceneObject, ObjectType} from '../types/scene';

const initialState: EditorState = {
    objects: [],
    selectedObjectId: null,
    isPlaying: false,
    currentStep: -1,
};

const editorSlice = createSlice({
    name: 'editor',
    initialState,
    reducers: {
        addObject: (state, action: PayloadAction<{ type: ObjectType }>) => {
            const newObject: SceneObject = {
                id: uuidv4(),
                type: action.payload.type,
                props: {
                    color: '#58C4DD',
                    fillOpacity: 0.5,
                    position: [0, 0, 0],
                    ...(action.payload.type === 'circle' && { radius: 1 }),
                    ...(action.payload.type === 'square' && { sideLength: 2 }),
                },
            };
            state.objects.push(newObject);
            state.selectedObjectId = newObject.id;
        },
        updateObjectProps: (state, action: PayloadAction<{ id: string; props: Partial<SceneObject['props']> }>) => {
            const obj = state.objects.find(o => o.id === action.payload.id);
            if (obj) {
                obj.props = { ...obj.props, ...action.payload.props };
            }
        },
        selectObject: (state, action: PayloadAction<string | null>) => {
            state.selectedObjectId = action.payload;
        },
        deleteObject: (state, action: PayloadAction<string>) => {
            state.objects = state.objects.filter(o => o.id !== action.payload);
            if (state.selectedObjectId === action.payload) {
                state.selectedObjectId = null;
            }
        },
    },
});

export const { addObject, updateObjectProps, selectObject, deleteObject } = editorSlice.actions;
export const store = configureStore({ reducer: { editor: editorSlice.reducer } });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;