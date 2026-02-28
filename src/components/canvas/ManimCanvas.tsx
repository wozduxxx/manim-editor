import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Scene, Circle, Square } from 'manim-web';
import type { RootState } from '../../store/editorStore';

export default function ManimCanvas() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<Scene | null>(null);
    const objects = useSelector((state: RootState) => state.editor.objects);

    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new Scene(containerRef.current);

        sceneRef.current = scene;

        (scene as any).start?.();

        return () => {
            (scene as any).stop?.();
            (scene as any).dispose?.();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        scene.clear?.();

        objects.forEach(obj => {
            try {
                if (obj.type === 'circle') {
                    const circle = new Circle({
                        radius: obj.props.radius || 1,
                        color: obj.props.color,
                        fillOpacity: obj.props.fillOpacity,
                    } as any);
                    scene.add(circle);
                }

                if (obj.type === 'square') {
                    const square = new Square({
                        sideLength: obj.props.sideLength || 2,
                        color: obj.props.color,
                        fillOpacity: obj.props.fillOpacity,
                    } as any);
                    scene.add(square);
                }
            } catch (e) {
                console.error("Error creating manim object:", e);
            }
        });

    }, [objects]);

    return (
        <div className="flex items-center justify-center w-full h-full bg-gray-900 p-4">
            <div
                ref={containerRef}
                className="w-[800px] h-[600px] border border-gray-700 rounded-lg shadow-2xl bg-gray-950"
            />
        </div>
    );
}