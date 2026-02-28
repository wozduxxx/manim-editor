import { Provider } from 'react-redux';
import { store } from './store/editorStore';
import ManimCanvas from './components/canvas/ManimCanvas';
import PropertiesPanel from './components/panel/PropertiesPanel';
import AddObjectButton from './components/ui/AddObjectButton';

function Editor() {
    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            <h1 className="text-2xl font-bold mb-6">Manim Web Visual Editor</h1>

            <div className="flex gap-6">
                <div className="flex-1 space-y-4">
                    <AddObjectButton />
                    <ManimCanvas />
                </div>

                <div className="w-80">
                    <PropertiesPanel />
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <Provider store={store}>
            <Editor />
        </Provider>
    );
}