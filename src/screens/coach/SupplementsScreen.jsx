import { useState, useEffect, useMemo } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui';
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

// ── Add supplement modal ──
function AddSupplementModal({ supplements, assigned, onAdd, onClose, coachId, onCustomAdded }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [timing, setTiming] = useState('morning');
  const [dosageOverride, setDosageOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [customName, setCustomName] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  const grouped = useMemo(() => {
    const groups = {};
    supplements.forEach(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return;
      const cat = s.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [supplements, search]);

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
    setSelectedId(null);
    setDosageOverride('');
    setNotes('');
    setTiming('morning');
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
              {search ? 'No supplements found.' : 'All supplements already assigned.'}
            </div>
          )}
        </div>

        {/* Configure selected */}
        {selected && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--b2)', background: 'var(--b2)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              Configure: {selected.name}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Dosage</label>
                <input
                  type="text" value={dosageOverride} onChange={e => setDosageOverride(e.target.value)}
                  placeholder="e.g. 5g"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--b3)', background: 'var(--b1)', fontSize: 12, color: 'var(--t1)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Timing</label>
                <select
                  value={timing} onChange={e => setTiming(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--b3)', background: 'var(--b1)', fontSize: 12, color: 'var(--t1)' }}
                >
                  {TIMING_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Notes (optional)</label>
              <input
                type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Take with food"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--b3)', background: 'var(--b1)', fontSize: 12, color: 'var(--t1)' }}
              />
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handleAdd}>
              <Icon name="plus" size={12} /> Assign to Client
            </button>
          </div>
        )}

        {/* Custom supplement box */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--b2)', background: 'var(--b1)' }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 500 }}>
            Can't find what you need? Add a custom supplement:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="Enter supplement name..."
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--b3)', background: 'var(--b2)', fontSize: 12, color: 'var(--t1)', outline: 'none' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleAddCustom} disabled={!customName.trim() || addingCustom}>
              {addingCustom ? '...' : 'Add & Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Editable assigned supplement row ──
function AssignedSupplementRow({ item, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [dosage, setDosage] = useState(item.dosage || '');
  const [timing, setTiming] = useState(item.timing || 'morning');
  const [notes, setNotes] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(item.id, { dosage, timing, notes });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDosage(item.dosage || '');
    setTiming(item.timing || 'morning');
    setNotes(item.notes || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{
        padding: '12px', marginBottom: 4, borderRadius: 10,
        border: '1px solid var(--gold)', background: 'var(--gold-d)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
          <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2 }}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Dosage</label>
            <input
              type="text" value={dosage} onChange={e => setDosage(e.target.value)}
              placeholder="e.g. 5g"
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--b3)', background: 'var(--b1)', fontSize: 12, color: 'var(--t1)' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Timing</label>
            <select
              value={timing} onChange={e => setTiming(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--b3)', background: 'var(--b1)', fontSize: 12, color: 'var(--t1)' }}
            >
              {TIMING_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Notes</label>
          <input
            type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Take with food"
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--b3)', background: 'var(--b1)', fontSize: 12, color: 'var(--t1)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onRemove(item.id)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
            <Icon name="x" size={12} /> Remove
          </button>
        </div>
      </div>
    );
  }

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
        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{item.dosage || 'No dosage set'}</div>
        {item.notes && (
          <div style={{ fontSize: 10, color: 'var(--t3)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <TimingBadge timing={item.timing} />
        <button
          onClick={() => setEditing(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--t3)' }}
          title="Edit dosage & timing"
        >
          <Icon name="settings" size={13} />
        </button>
        <button
          onClick={() => onRemove(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--t3)' }}
          title="Remove"
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Main Coach Supplements Screen ──
export default function SupplementsScreen() {
  const { user } = useAuthStore();
  const { clients } = useCoachStore();
  const coachId = user?.id;

  const [selectedClientId, setSelectedClientId] = useState(null);
  const [supplements, setSupplements] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Filter out pending clients
  const activeClients = useMemo(() =>
    (clients || []).filter(c => !c.isPending),
  [clients]);

  // Auto-select first client
  useEffect(() => {
    if (!selectedClientId && activeClients.length > 0) {
      setSelectedClientId(activeClients[0].client_id || activeClients[0].id);
    }
  }, [activeClients, selectedClientId]);

  // Load data when client changes
  useEffect(() => {
    if (!selectedClientId || !coachId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [list, clientSupps] = await Promise.allSettled([
        fetchSupplementsList(coachId),
        fetchClientSupplements(selectedClientId),
      ]);
      if (cancelled) return;
      setSupplements(list.status === 'fulfilled' ? list.value : []);
      setAssigned(clientSupps.status === 'fulfilled' ? clientSupps.value : []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [selectedClientId, coachId]);

  const handleAdd = async (supp) => {
    const result = await assignSupplement(selectedClientId, coachId, supp);
    if (result.ok) {
      setAssigned(prev => [...prev, result.data]);
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

  const selectedClient = activeClients.find(c => (c.client_id || c.id) === selectedClientId);
  const clientName = selectedClient?.client_name || selectedClient?.name || 'Client';

  return (
    <div className="screen active">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Supplements</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
            Manage supplement protocols for your clients
          </div>
        </div>
      </div>

      {/* Client selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
          Select Client
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {activeClients.map(c => {
            const cId = c.client_id || c.id;
            const name = c.client_name || c.name || 'Client';
            const isActive = cId === selectedClientId;
            return (
              <button
                key={cId}
                onClick={() => setSelectedClientId(cId)}
                className={`chip ${isActive ? 'active' : ''}`}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                {name}
              </button>
            );
          })}
        </div>
        {activeClients.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
            No active clients yet. Add a client first.
          </div>
        )}
      </div>

      {/* Client's supplements */}
      {selectedClientId && (
        <>
          {loading ? (
            <Card>
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
                Loading supplements for {clientName}...
              </div>
            </Card>
          ) : (
            <Card title={`${clientName}'s Protocol`} subtitle={`${assigned.length} supplement${assigned.length !== 1 ? 's' : ''}`}>
              {assigned.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>💊</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
                    No supplements assigned to {clientName} yet.
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                    <Icon name="plus" size={12} /> Add Supplements
                  </button>
                </div>
              ) : (
                <>
                  {groupedByTiming.map(([timingKey, items]) => {
                    const opt = TIMING_OPTIONS.find(t => t.value === timingKey) || TIMING_OPTIONS[0];
                    return (
                      <div key={timingKey} style={{ marginBottom: 14 }}>
                        <div style={{
                          fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase',
                          letterSpacing: 1, marginBottom: 6, fontWeight: 600,
                        }}>
                          {opt.emoji} {opt.label}
                        </div>
                        {items.map(item => (
                          <AssignedSupplementRow
                            key={item.id}
                            item={item}
                            onUpdate={handleUpdate}
                            onRemove={handleRemove}
                          />
                        ))}
                      </div>
                    );
                  })}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAdd(true)}
                    style={{ width: '100%', marginTop: 10 }}
                  >
                    <Icon name="plus" size={12} /> Add More Supplements
                  </button>
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* Add modal */}
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
    </div>
  );
}
