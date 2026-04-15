import { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui';
import { Icon } from '../../utils/icons';
import {
  fetchSupplementsList,
  fetchClientSupplements,
  assignSupplement,
  updateClientSupplement,
  removeClientSupplement,
  addCustomSupplement,
} from '../../services/supplements';

const TIMING_OPTIONS = [
  { value: 'morning', label: 'Morning', emoji: '🌅' },
  { value: 'pre-workout', label: 'Pre-Workout', emoji: '💪' },
  { value: 'intra-workout', label: 'Intra-Workout', emoji: '🏋️' },
  { value: 'post-workout', label: 'Post-Workout', emoji: '🔄' },
  { value: 'with-meal', label: 'With Meal', emoji: '🍽️' },
  { value: 'before-bed', label: 'Before Bed', emoji: '🌙' },
  { value: 'any-time', label: 'Any Time', emoji: '⏰' },
];

const CATEGORY_LABELS = {
  performance: '💪 Performance',
  protein: '🥩 Protein',
  health: '🩺 Health',
  sleep: '🌙 Sleep',
  focus: '🧠 Focus',
  recovery: '🔄 Recovery',
  hydration: '💧 Hydration',
  custom: '✏️ Custom',
  general: '📦 General',
};

function TimingBadge({ timing }) {
  const opt = TIMING_OPTIONS.find(t => t.value === timing) || TIMING_OPTIONS[0];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      background: 'var(--b2)', color: 'var(--t2)',
    }}>
      {opt.emoji} {opt.label}
    </span>
  );
}

// ── Assigned supplement row ──
function AssignedRow({ item, onRemove, onUpdate }) {
  const [editTiming, setEditTiming] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      borderBottom: '1px solid var(--b2)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name="pill" size={14} style={{ color: 'var(--gold)' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
          {item.dosage || 'No dosage set'}
        </div>
        {item.notes && (
          <div style={{ fontSize: 10, color: 'var(--t3)', fontStyle: 'italic', marginTop: 2 }}>
            {item.notes}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {editTiming ? (
          <select
            value={item.timing}
            onChange={(e) => {
              onUpdate(item.id, { timing: e.target.value });
              setEditTiming(false);
            }}
            onBlur={() => setEditTiming(false)}
            autoFocus
            style={{
              fontSize: 10, padding: '3px 6px', borderRadius: 6,
              background: 'var(--b2)', border: '1px solid var(--b3)',
              color: 'var(--t1)',
            }}
          >
            {TIMING_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditTiming(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            title="Change timing"
          >
            <TimingBadge timing={item.timing} />
          </button>
        )}

        <button
          onClick={() => onRemove(item.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--t3)', borderRadius: 4,
          }}
          title="Remove supplement"
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Add supplement modal ──
function AddSupplementModal({ supplements, assigned, onAdd, onClose, coachId, onCustomAdded }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [timing, setTiming] = useState('morning');
  const [dosageOverride, setDosageOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [customName, setCustomName] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  const assignedNames = new Set(assigned.map(a => a.name.toLowerCase()));

  const grouped = useMemo(() => {
    const groups = {};
    supplements.forEach(s => {
      if (assignedNames.has(s.name.toLowerCase())) return;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return;
      const cat = s.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [supplements, search, assignedNames]);

  const selected = supplements.find(s => s.id === selectedId);

  const handleAdd = () => {
    if (!selected) return;
    onAdd({
      supplement_id: selected.id,
      name: selected.name,
      dosage: dosageOverride || selected.default_dosage || '',
      timing,
      notes,
    });
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    setAddingCustom(true);
    const result = await addCustomSupplement(coachId, customName.trim());
    if (result.ok && result.data) {
      onCustomAdded(result.data);
      onAdd({
        supplement_id: result.data.id,
        name: result.data.name,
        dosage: dosageOverride || '',
        timing,
        notes,
      });
    }
    setAddingCustom(false);
    setCustomName('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--b1)', borderRadius: 14, width: '90%', maxWidth: 520,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--b3)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--b2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Add Supplement</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--t3)' }} />
            <input
              type="text"
              placeholder="Search supplements..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8,
                border: '1px solid var(--b3)', background: 'var(--b2)',
                fontSize: 13, color: 'var(--t1)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase',
                letterSpacing: 1, marginBottom: 6, fontWeight: 600,
              }}>
                {CATEGORY_LABELS[cat] || cat}
              </div>
              {items.map(s => {
                const isSelected = selectedId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedId(isSelected ? null : s.id);
                      if (!isSelected) setDosageOverride(s.default_dosage || '');
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 10px', marginBottom: 4, borderRadius: 8,
                      border: isSelected ? '1px solid var(--gold)' : '1px solid transparent',
                      background: isSelected ? 'var(--gold-d)' : 'var(--b2)',
                      cursor: 'pointer', color: 'var(--t1)', fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                      {s.default_dosage || 'No default dosage'}{s.description ? ` — ${s.description}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
              {search ? 'No supplements found matching your search.' : 'All supplements already assigned.'}
            </div>
          )}
        </div>

        {/* Configure selected */}
        {selected && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--b2)',
            background: 'var(--b2)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              Configure: {selected.name}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Dosage</label>
                <input
                  type="text"
                  value={dosageOverride}
                  onChange={e => setDosageOverride(e.target.value)}
                  placeholder="e.g. 5g"
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: 6,
                    border: '1px solid var(--b3)', background: 'var(--b1)',
                    fontSize: 12, color: 'var(--t1)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Timing</label>
                <select
                  value={timing}
                  onChange={e => setTiming(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: 6,
                    border: '1px solid var(--b3)', background: 'var(--b1)',
                    fontSize: 12, color: 'var(--t1)',
                  }}
                >
                  {TIMING_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Take with food"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6,
                  border: '1px solid var(--b3)', background: 'var(--b1)',
                  fontSize: 12, color: 'var(--t1)',
                }}
              />
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handleAdd}>
              <Icon name="plus" size={12} /> Assign to Client
            </button>
          </div>
        )}

        {/* Custom supplement box */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--b2)',
          background: 'var(--b1)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 500 }}>
            Can't find what you need? Add a custom supplement:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Enter supplement name..."
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--b3)', background: 'var(--b2)',
                fontSize: 12, color: 'var(--t1)', outline: 'none',
              }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAddCustom}
              disabled={!customName.trim() || addingCustom}
            >
              {addingCustom ? '...' : 'Add & Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel (compact) ──
export default function SupplementsPanel({ clientId, coachId }) {
  const [supplements, setSupplements] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    const [list, clientSupps] = await Promise.allSettled([
      fetchSupplementsList(coachId),
      fetchClientSupplements(clientId),
    ]);
    setSupplements(list.status === 'fulfilled' ? list.value : []);
    setAssigned(clientSupps.status === 'fulfilled' ? clientSupps.value : []);
    setLoading(false);
  };

  useEffect(() => {
    if (clientId && coachId) load();
  }, [clientId, coachId]);

  const handleAdd = async (supp) => {
    const result = await assignSupplement(clientId, coachId, supp);
    if (result.ok) {
      setAssigned(prev => [...prev, result.data]);
      setShowAdd(false);
    }
  };

  const handleRemove = async (id) => {
    const result = await removeClientSupplement(id);
    if (result.ok) setAssigned(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdate = async (id, updates) => {
    const result = await updateClientSupplement(id, updates);
    if (result.ok) setAssigned(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleCustomAdded = (newSupp) => {
    setSupplements(prev => [...prev, newSupp]);
  };

  // Group assigned by timing
  const groupedByTiming = useMemo(() => {
    const groups = {};
    TIMING_OPTIONS.forEach(t => { groups[t.value] = []; });
    assigned.forEach(s => {
      const key = s.timing || 'morning';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [assigned]);

  if (loading) {
    return (
      <Card title="Supplements">
        <div style={{ textAlign: 'center', padding: 12, color: 'var(--t3)', fontSize: 12 }}>
          Loading...
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title="Supplements" subtitle={`${assigned.length} assigned`}>
        {assigned.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
              No supplements assigned yet.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <Icon name="plus" size={12} /> Add Supplements
            </button>
          </div>
        ) : (
          <>
            {/* Compact summary: show supplement names as small tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {assigned.slice(0, expanded ? assigned.length : 5).map(s => (
                <span key={s.id} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 12,
                  background: 'var(--b2)', color: 'var(--t2)',
                  whiteSpace: 'nowrap',
                }}>
                  {s.name}
                </span>
              ))}
              {!expanded && assigned.length > 5 && (
                <span style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 12,
                  background: 'var(--gold-d)', color: 'var(--gold)',
                  whiteSpace: 'nowrap',
                }}>
                  +{assigned.length - 5} more
                </span>
              )}
            </div>

            {/* Expand / collapse */}
            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                style={{
                  width: '100%', padding: '6px 0', fontSize: 11, color: 'var(--gold)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <Icon name="chevron" size={10} style={{ transform: 'rotate(90deg)' }} /> View full protocol
              </button>
            ) : (
              <>
                {/* Full grouped list */}
                <div style={{ borderTop: '1px solid var(--b2)', paddingTop: 10, marginTop: 4 }}>
                  {groupedByTiming.map(([timingKey, items]) => {
                    const opt = TIMING_OPTIONS.find(t => t.value === timingKey) || TIMING_OPTIONS[0];
                    return (
                      <div key={timingKey} style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase',
                          letterSpacing: 1, marginBottom: 3, fontWeight: 600,
                        }}>
                          {opt.emoji} {opt.label}
                        </div>
                        {items.map(item => (
                          <AssignedRow
                            key={item.id}
                            item={item}
                            onRemove={handleRemove}
                            onUpdate={handleUpdate}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAdd(true)}
                    style={{ flex: 1 }}
                  >
                    <Icon name="plus" size={12} /> Add More
                  </button>
                  <button
                    onClick={() => setExpanded(false)}
                    style={{
                      padding: '6px 12px', fontSize: 11, color: 'var(--t3)',
                      background: 'none', border: '1px solid var(--b3)',
                      borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    Collapse
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      {/* Modal */}
      {showAdd && (
        <AddSupplementModal
          supplements={supplements}
          assigned={assigned}
          coachId={coachId}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
          onCustomAdded={handleCustomAdded}
        />
      )}
    </>
  );
}
