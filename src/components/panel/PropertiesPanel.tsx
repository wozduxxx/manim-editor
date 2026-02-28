/**
 * PropertiesPanel
 *
 * Uses leva correctly:
 *   - folder()     for grouping controls
 *   - button()     for actions
 *   - useCreateStore() + <LevaPanel /> for inline rendering
 *   - key={obj.id} on the wrapper forces full remount when selection changes
 */

import { useSelector, useDispatch } from 'react-redux';
import { updateObjectProps, deleteObject, selectObject } from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { SceneObject } from '../../types/scene';
import { useControls, useCreateStore, LevaPanel, folder } from 'leva';
// import {Schema} from "leva/plugin";

// ── Leva dark theme ────────────────────────────────────────────────────────────
const levaTheme = {
  colors: {
    elevation1: '#0d0d18',
    elevation2: '#13131f',
    elevation3: '#1a1a28',
    accent1: '#58C4DD',
    accent2: '#7ad6e8',
    accent3: '#9ae2f0',
    highlight1: '#3a3a58',
    highlight2: '#5a5a80',
    highlight3: '#8080aa',
    vivid1: '#58C4DD',
    folderWidgetColor: '#4a4a6a',
    folderTextColor: '#6060a0',
    toolTipBackground: '#0d0d18',
    toolTipText: '#e0e0f0',
  },
  radii: { xs: '2px', sm: '3px', lg: '5px' },
  space: { sm: '4px', md: '8px', rowGap: '3px', colGap: '6px' },
  fontSizes: { root: '10px' },
  fonts: {
    mono: "'JetBrains Mono','Fira Code',monospace",
    sans: "'JetBrains Mono','Fira Code',monospace",
  },
  sizes: {
    rootWidth: '100%',
    controlWidth: '52%',
    scrubberWidth: '8px',
    scrubberHeight: '14px',
    rowHeight: '26px',
    folderTitleHeight: '22px',
    checkboxSize: '14px',
    joystickWidth: '80px',
    joystickHeight: '80px',
    colorPickerWidth: '100%',
    imagePreviewSize: '60px',
  },
  borderWidths: { root: '0px', input: '1px', focus: '1px', hover: '1px', active: '1px', folder: '1px' },
  // ✅ ИСПРАВЛЕНО: строки вместо чисел
  fontWeights: { label: '500', folder: '700', button: '600' },
};

// ── Inner panel ───────────────────────────────────────────────────────────────

function ObjectControls({ obj }: { obj: SceneObject }) {
  const dispatch = useDispatch<AppDispatch>();
  const store = useCreateStore();

  const update = (props: Partial<SceneObject['props']>) =>
      dispatch(updateObjectProps({ id: obj.id, props }));

  const geometryControls =
      obj.type === 'circle'
          ? {
            radius: {
              value: obj.props.radius ?? 1,
              min: 0.1,
              max: 8,
              step: 0.05,
              onChange: (v: number) => update({ radius: v }),
              transient: false,
            },
          }
          : {
            sideLength: {
              value: obj.props.sideLength ?? 2,
              min: 0.1,
              max: 8,
              step: 0.05,
              onChange: (v: number) => update({ sideLength: v }),
              transient: false,
            },
          };

  useControls(
      () => ({
        Appearance: folder(
            {
              color: {
                value: obj.props.color,
                onChange: (v: string) => update({ color: v }),
                transient: false,
              },
              fillOpacity: {
                value: obj.props.fillOpacity,
                min: 0,
                max: 1,
                step: 0.01,
                onChange: (v: number) => update({ fillOpacity: v }),
                transient: false,
              },
              strokeWidth: {
                value: obj.props.strokeWidth ?? 2,
                min: 0,
                max: 12,
                step: 0.5,
                onChange: (v: number) => update({ strokeWidth: v }),
                transient: false,
              },
            },
            { collapsed: false }
        ),

        Geometry: folder(geometryControls, { collapsed: false }),

        Position: folder(
            {
              posX: {
                value: obj.props.position[0],
                min: -7,
                max: 7,
                step: 0.1,
                onChange: (v: number) =>
                    update({ position: [v, obj.props.position[1], obj.props.position[2]] }),
                transient: false,
              },
              posY: {
                value: obj.props.position[1],
                min: -4,
                max: 4,
                step: 0.1,
                onChange: (v: number) =>
                    update({ position: [obj.props.position[0], v, obj.props.position[2]] }),
                transient: false,
              },
            },
            { collapsed: false }
        ),
      }),
      { store }
  );

  return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <LevaPanel store={store} theme={levaTheme} fill flat hideCopyButton titleBar={false} />
      </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = { circle: '◉', square: '▣', triangle: '▲' };

export default function PropertiesPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const selectedId = useSelector((s: RootState) => s.editor.selectedObjectId);
  const objects = useSelector((s: RootState) => s.editor.objects);
  const obj = objects.find(o => o.id === selectedId);

  return (
      <div
          style={{
            background: '#111118',
            borderLeft: '1px solid #1e1e2e',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
      >
        {/* Header */}
        <div
            style={{
              padding: '10px 12px 9px',
              borderBottom: '1px solid #1e1e2e',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
        >
        <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#3a3a55',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}
        >
          Properties
        </span>
          {obj && (
              <span style={{ fontSize: 10, color: obj.props.color, fontFamily: 'monospace' }}>
            {TYPE_ICON[obj.type]} {obj.type}
          </span>
          )}
        </div>

        {/* Content */}
        {!obj ? (
            <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: '#1e1e30',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  textAlign: 'center',
                  padding: 20,
                }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle
                    cx="14"
                    cy="14"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeDasharray="3 2.5"
                />
              </svg>
              Select an object
              <br />
              to edit properties
            </div>
        ) : (
            <ObjectControls key={obj.id} obj={obj} />
        )}

        {/* Delete button */}
        {obj && (
            <div style={{ padding: '8px 10px', borderTop: '1px solid #1e1e2e', flexShrink: 0 }}>
              <button
                  onClick={() => {
                    dispatch(deleteObject(obj.id));
                    dispatch(selectObject(null));
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 0',
                    background: 'transparent',
                    border: '1px solid #2a1a1a',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#6a3333',
                    letterSpacing: '0.06em',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(252,98,85,0.08)';
                    e.currentTarget.style.borderColor = '#4a2222';
                    e.currentTarget.style.color = '#FC6255';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#2a1a1a';
                    e.currentTarget.style.color = '#6a3333';
                  }}
              >
                Delete Object
              </button>
            </div>
        )}
      </div>
  );
}