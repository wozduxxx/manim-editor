import { useEffect } from 'react';
import { useControls } from 'leva';
import { useSelector, useDispatch } from 'react-redux';
import { updateObjectProps, deleteObject } from '../../store/editorStore';
import type {RootState, AppDispatch} from '../../store/editorStore';
import type {SceneObject} from '../../types/scene';

export default function PropertiesPanel() {
    const dispatch = useDispatch<AppDispatch>();
    const selectedObjectId = useSelector((state: RootState) => state.editor.selectedObjectId);
    const objects = useSelector((state: RootState) => state.editor.objects);

    const selectedObject = objects.find(o => o.id === selectedObjectId);

    // Leva панель с динамическими полями
    const values = useControls(
        'Properties',
        {
            color: {
                value: selectedObject?.props.color || '#58C4DD',
                label: 'Color',
            },
            fillOpacity: {
                value: selectedObject?.props.fillOpacity ?? 0.5,
                min: 0,
                max: 1,
                step: 0.1,
                label: 'Opacity',
            },
            ...(selectedObject?.type === 'circle' && {
                radius: {
                    value: selectedObject?.props.radius ?? 1,
                    min: 0.1,
                    max: 5,
                    step: 0.1,
                    label: 'Radius',
                },
            }),
            ...(selectedObject?.type === 'square' && {
                sideLength: {
                    value: selectedObject?.props.sideLength ?? 2,
                    min: 0.1,
                    max: 5,
                    step: 0.1,
                    label: 'Side Length',
                },
            }),
        },
        [selectedObject]
    ) as any;

    // Синхронизация Leva значений с Redux
    useEffect(() => {
        if (!selectedObject) return;

        const propsToUpdate: Partial<SceneObject['props']> = {};

        if (values.color !== selectedObject.props.color) {
            propsToUpdate.color = values.color;
        }
        if (values.fillOpacity !== selectedObject.props.fillOpacity) {
            propsToUpdate.fillOpacity = values.fillOpacity;
        }
        if ('radius' in values && values.radius !== selectedObject.props.radius) {
            propsToUpdate.radius = values.radius;
        }
        if ('sideLength' in values && values.sideLength !== selectedObject.props.sideLength) {
            propsToUpdate.sideLength = values.sideLength;
        }

        if (Object.keys(propsToUpdate).length > 0) {
            dispatch(updateObjectProps({
                id: selectedObject.id,
                props: propsToUpdate,
            }));
        }
    }, [values, selectedObject, dispatch]);

    if (!selectedObject) {
        return (
            <div className="p-4 bg-gray-800 rounded-lg text-gray-400">
                <p>Select an object to edit properties</p>
            </div>
        );
    }

    return (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-white">
                    {selectedObject.type.toUpperCase()} ({selectedObject.id.slice(0, 8)}...)
                </h3>
                <button
                    onClick={() => dispatch(deleteObject(selectedObject.id))}
                    className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700"
                >
                    Delete
                </button>
            </div>

            {/* Leva рендерится автоматически через useControls */}
            <div className="text-xs text-gray-500">
                <p>Use the panel above to edit properties</p>
            </div>
        </div>
    );
}