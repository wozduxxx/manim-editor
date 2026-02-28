import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  addObject, selectObject, deleteObject,
  duplicateObject, toggleVisibility, updateObjectLabel,
} from '../../store/editorStore';
import type { RootState, AppDispatch } from '../../store/editorStore';
import type { ObjectType } from '../../types/scene';

const TYPE_ICON: Record<ObjectType, string> = { circle: '◉', square: '▣', triangle: '▲' };

const ADD_BTNS: { type: ObjectType; label: string; color: string }[] = [
  { type: 'circle',   label: 'Circle',   color: '#58C4DD' },
  { type: 'square',   label: 'Square',   color: '#FC6255' },
  { type: 'triangle', label: 'Triangle', color: '#83C167' },
];

export default function ObjectsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const objects = useSelector((s: RootState) => s.editor.objects);
  const selectedId = useSelector((s: RootState) => s.editor.selectedObjectId);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (id: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditId(id);
    setEditVal(label);
  };

  const commitEdit = () => {
    if (editId && editVal.trim()) dispatch(updateObjectLabel({ id: editId, label: editVal.trim() }));
    setEditId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111118', borderRight: '1px solid #1e1e2e' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #1e1e2e' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#4a4a6a', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          Layers
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {objects.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: '#2a2a40', textAlign: 'center', fontFamily: 'monospace' }}>
            No objects
          </div>
        )}
        {[...objects].reverse().map(obj => {
          const isSel = obj.id === selectedId;
          return (
            <div
              key={obj.id}
              onClick={() => dispatch(selectObject(obj.id))}
              className="layer-row group"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px 5px 12px',
                cursor: 'pointer',
                background: isSel ? 'rgba(88,196,221,0.08)' : 'transparent',
                borderLeft: isSel ? `2px solid ${obj.props.color}` : '2px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              {/* Color dot + icon */}
              <span style={{ fontSize: 12, color: obj.props.color, opacity: obj.visible ? 1 : 0.3, flexShrink: 0 }}>
                {TYPE_ICON[obj.type]}
              </span>

              {/* Label */}
              {editId === obj.id ? (
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); e.stopPropagation(); }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, fontSize: 11, fontFamily: 'monospace',
                    background: '#0d0d1a', border: '1px solid #58C4DD',
                    color: '#e0e0f0', borderRadius: 3, padding: '1px 5px', outline: 'none', minWidth: 0,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={e => startEdit(obj.id, obj.label, e)}
                  style={{
                    flex: 1, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.02em',
                    color: isSel ? '#e0e0f0' : (obj.visible ? '#8888aa' : '#3a3a55'),
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {obj.label}
                </span>
              )}

              {/* Actions */}
              <div className="row-actions" style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: isSel ? 1 : 0, transition: 'opacity 0.1s' }}>
                <button
                  onClick={e => { e.stopPropagation(); dispatch(toggleVisibility(obj.id)); }}
                  title="Toggle visibility"
                  style={{ ...iconBtn, color: obj.visible ? '#6666aa' : '#33334a' }}
                >
                  {obj.visible ? '👁' : '◌'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); dispatch(duplicateObject(obj.id)); }}
                  title="Duplicate"
                  style={{ ...iconBtn, color: '#6666aa' }}
                >
                  ⎘
                </button>
                <button
                  onClick={e => { e.stopPropagation(); dispatch(deleteObject(obj.id)); }}
                  title="Delete"
                  style={{ ...iconBtn, color: '#6a3333' }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add buttons */}
      <div style={{ padding: 8, borderTop: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ADD_BTNS.map(({ type, label, color }) => (
          <button
            key={type}
            onClick={() => dispatch(addObject({ type }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px',
              background: 'transparent', border: '1px solid #1e1e2e',
              borderRadius: 5, cursor: 'pointer', color: '#6666aa',
              fontSize: 11, fontFamily: 'monospace',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.color = color; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e2e'; (e.currentTarget as HTMLButtonElement).style.color = '#6666aa'; }}
          >
            <span style={{ color }}>{TYPE_ICON[type]}</span>
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 20, height: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 10, borderRadius: 3, padding: 0,
};
