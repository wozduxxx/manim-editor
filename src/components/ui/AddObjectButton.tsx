import { useDispatch } from 'react-redux';
import { addObject } from '../../store/editorStore';
import type {AppDispatch} from '../../store/editorStore';

export default function AddObjectButton() {
    const dispatch = useDispatch<AppDispatch>();

    return (
        <div className="flex gap-2">
            <button
                onClick={() => dispatch(addObject({ type: 'circle' }))}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
            >
                + Circle
            </button>
            <button
                onClick={() => dispatch(addObject({ type: 'square' }))}
                className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition"
            >
                + Square
            </button>
        </div>
    );
}