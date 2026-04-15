import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';
import { Card, ConfirmDialog } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useUIStore } from '../../stores/uiStore';
import { saveMealPlan, saveNutritionTemplate, deleteNutritionTemplate } from '../../services/nutrition';
import FOOD_DATABASE, { FOOD_CATEGORIES, CATEGORY_COLORS, computeMacros, searchFoods } from '../../data/foodDatabase';
import { useUnsavedWarning } from '../../hooks/useUnsavedWarning';

// ── Drag grip handle ──
function DragGrip({ style }) {
  return (
    <span style={{ cursor: 'grab', opacity: 0.3, fontSize: 12, userSelect: 'none', lineHeight: 1, ...style }}>⠿</span>
  );
}

// ── Macro summary bar ──
function MacroSummary({ meals, targets }) {
  const t = useT();
  let totals = { kcal: 0, p: 0, c: 0, f: 0 };
  (meals || []).forEach(m => (m.foods || []).forEach(f => { totals.kcal += f.kcal || 0; totals.p += f.p || 0; totals.c += f.c || 0; totals.f += f.f || 0; }));

  const macros = [
    { label: t('calories'), val: Math.round(totals.kcal), max: targets.calories, unit: t('kcal'), color: 'var(--gold)' },
    { label: t('protein'), val: Math.round(totals.p), max: targets.protein, unit: t('g'), color: 'var(--green)' },
    { label: t('carbs'), val: Math.round(totals.c), max: targets.carbs, unit: t('g'), color: 'var(--blue)' },
    { label: t('fat'), val: Math.round(totals.f), max: targets.fat, unit: t('g'), color: 'var(--orange)' },
  ];

  return (
    <div className="g4" style={{ marginBottom: 18 }}>
      {macros.map(m => (
        <Card key={m.label}>
          <div className="kl">{m.label}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--fd)', fontSize: 22, color: m.color }}>{m.val}</span>
            <span className="ku">/ {m.max} {m.unit}</span>
          </div>
          <div className="pbar" style={{ marginTop: 6 }}>
            <div className="pfill" style={{ width: `${m.max ? Math.min((m.val / m.max) * 100, 100) : 0}%`, background: m.color }} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Food Picker with search + categories ──
function FoodPicker({ onSelect, onCancel }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedFood, setSelectedFood] = useState(null);
  const [grams, setGrams] = useState('100');
  const [customMode, setCustomMode] = useState(false);
  const [customFood, setCustomFood] = useState({ fname: '', grams: '', kcal: '', p: '', c: '', f: '' });
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const results = useMemo(() => searchFoods(query, category), [query, category]);
  const preview = selectedFood && grams ? computeMacros(selectedFood, parseInt(grams) || 100) : null;

  const handleSelectFromDB = () => {
    if (!preview) return;
    onSelect({ ...preview, per100: selectedFood.per100 });
  };

  const handleCustomAdd = () => {
    if (!customFood.fname.trim()) return;
    const g = Math.max(1, parseInt(customFood.grams) || 100);
    const kcal = Math.max(0, parseInt(customFood.kcal) || 0);
    const p = Math.max(0, parseInt(customFood.p) || 0);
    const c = Math.max(0, parseInt(customFood.c) || 0);
    const f = Math.max(0, parseInt(customFood.f) || 0);
    // Store per100 so grams can be changed later
    const per100 = {
      kcal: g > 0 ? Math.round((kcal / g) * 100) : kcal,
      p: g > 0 ? Math.round((p / g) * 100) : p,
      c: g > 0 ? Math.round((c / g) * 100) : c,
      f: g > 0 ? Math.round((f / g) * 100) : f,
    };
    onSelect({ fname: customFood.fname, grams: g, kcal, p, c, f, per100 });
  };

  if (customMode) {
    return (
      <div style={{ marginTop: 10, padding: 12, background: 'var(--c2)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{t('customFood')}</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setCustomMode(false)}>
            <Icon name="chevron-left" size={9} /> {t('backToSearch')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input className="form-inp" placeholder={t('foodName')} value={customFood.fname} onChange={e => setCustomFood({ ...customFood, fname: e.target.value })} style={{ flex: 2, minWidth: 120 }} />
          <input className="form-inp" placeholder={t('g')} value={customFood.grams} onChange={e => setCustomFood({ ...customFood, grams: e.target.value })} style={{ width: 55 }} type="number" />
          <input className="form-inp" placeholder={t('kcal')} value={customFood.kcal} onChange={e => setCustomFood({ ...customFood, kcal: e.target.value })} style={{ width: 55 }} type="number" />
          <input className="form-inp" placeholder="P" value={customFood.p} onChange={e => setCustomFood({ ...customFood, p: e.target.value })} style={{ width: 45 }} type="number" />
          <input className="form-inp" placeholder="C" value={customFood.c} onChange={e => setCustomFood({ ...customFood, c: e.target.value })} style={{ width: 45 }} type="number" />
          <input className="form-inp" placeholder="F" value={customFood.f} onChange={e => setCustomFood({ ...customFood, f: e.target.value })} style={{ width: 45 }} type="number" />
          <button className="btn btn-primary btn-sm" onClick={handleCustomAdd}>{t('add')}</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t('cancel')}</button>
        </div>
      </div>
    );
  }

  // Selected food — show grams input + preview
  if (selectedFood) {
    return (
      <div style={{ marginTop: 10, padding: 12, background: 'var(--c2)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedFood.name}</div>
            <span style={{ fontSize: 10, color: CATEGORY_COLORS[selectedFood.cat] || 'var(--t3)', background: 'var(--c3)', padding: '1px 6px', borderRadius: 4 }}>{selectedFood.cat}</span>
          </div>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setSelectedFood(null)}>
            <Icon name="x" size={9} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--t3)' }}>Grams</label>
            <input className="form-inp" type="number" value={grams} onChange={e => setGrams(e.target.value)}
              style={{ width: 70, marginTop: 3 }} autoFocus />
          </div>
          {/* Quick gram buttons */}
          {[50, 100, 150, 200, 250].map(g => (
            <button key={g} className={`btn btn-sm ${grams === String(g) ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => setGrams(String(g))}>
              {g}g
            </button>
          ))}
        </div>
        {preview && (
          <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 10 }}>
            <span style={{ color: 'var(--gold)' }}><strong>{preview.kcal}</strong> kcal</span>
            <span style={{ color: 'var(--green)' }}>P: <strong>{preview.p}g</strong></span>
            <span style={{ color: 'var(--blue)' }}>C: <strong>{preview.c}g</strong></span>
            <span style={{ color: 'var(--orange)' }}>F: <strong>{preview.f}g</strong></span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSelectFromDB}>{t('addToMeal')}</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t('cancel')}</button>
        </div>
      </div>
    );
  }

  // Search + browse view
  return (
    <div style={{ marginTop: 10, padding: 12, background: 'var(--c2)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          <Icon name="search" size={11} /> Food Database ({FOOD_DATABASE.length} items)
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setCustomMode(true)}>
            <Icon name="edit" size={9} /> Custom
          </button>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={onCancel}>
            <Icon name="x" size={9} />
          </button>
        </div>
      </div>

      {/* Search input */}
      <input ref={searchRef} className="form-inp" placeholder="Search foods... e.g. chicken, rice, banana"
        value={query} onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', marginBottom: 8, fontSize: 13 }} />

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {FOOD_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
              border: 'none',
              background: category === cat ? (CATEGORY_COLORS[cat] || 'var(--gold)') : 'var(--c3)',
              color: category === cat ? '#fff' : 'var(--t2)',
              opacity: category === cat ? 1 : 0.7,
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div style={{ maxHeight: 240, overflowY: 'auto', borderRadius: 8 }}>
        {results.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
            No foods found. Try a different search or <button style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }} onClick={() => setCustomMode(true)}>add custom food</button>.
          </div>
        ) : results.slice(0, 30).map((food, i) => (
          <div key={i} onClick={() => { setSelectedFood(food); setGrams('100'); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', cursor: 'pointer', borderRadius: 6,
              background: i % 2 === 0 ? 'transparent' : 'var(--c1)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c3)'}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--c1)'}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{food.name}</div>
              <span style={{ fontSize: 9, color: CATEGORY_COLORS[food.cat] || 'var(--t3)' }}>{food.cat}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--gold)' }}>{food.per100.kcal}</span> kcal ·
              <span style={{ color: 'var(--green)' }}> P{food.per100.p}</span> ·
              <span style={{ color: 'var(--blue)' }}> C{food.per100.c}</span> ·
              <span style={{ color: 'var(--orange)' }}> F{food.per100.f}</span>
              <span style={{ opacity: 0.5 }}> /100g</span>
            </div>
          </div>
        ))}
        {results.length > 30 && (
          <div style={{ padding: 8, textAlign: 'center', fontSize: 10, color: 'var(--t3)' }}>
            Showing 30 of {results.length} — refine your search
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meal editor card (with food drag reorder) ──
function MealEditor({ meal, mealIdx, onUpdate, onRemove, onMealDragStart, onMealDragOver, onMealDrop, isDraggingMeal }) {
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [mealName, setMealName] = useState(meal.name);
  const [mealTime, setMealTime] = useState(meal.time || '');
  const [dragFoodIdx, setDragFoodIdx] = useState(null);
  const [dragOverFoodIdx, setDragOverFoodIdx] = useState(null);

  const handleAddFood = (food) => {
    onUpdate(mealIdx, { ...meal, foods: [...(meal.foods || []), food] });
    setAdding(false);
  };

  const handleRemoveFood = (foodIdx) => {
    onUpdate(mealIdx, { ...meal, foods: (meal.foods || []).filter((_, i) => i !== foodIdx) });
  };

  const handleGramsChange = (foodIdx, newGrams) => {
    const parsed = parseInt(newGrams);
    if (isNaN(parsed)) return;
    const g = Math.max(0, parsed);
    const food = meal.foods[foodIdx];
    const per100 = food.per100;
    let updated;
    if (per100) {
      const ratio = g / 100;
      updated = { ...food, grams: g, kcal: Math.round(per100.kcal * ratio), p: Math.round(per100.p * ratio), c: Math.round(per100.c * ratio), f: Math.round(per100.f * ratio) };
    } else {
      const oldG = food.grams || 100;
      const ratio = oldG > 0 ? g / oldG : 1;
      updated = { ...food, grams: g, kcal: Math.round((food.kcal || 0) * ratio), p: Math.round((food.p || 0) * ratio), c: Math.round((food.c || 0) * ratio), f: Math.round((food.f || 0) * ratio) };
    }
    onUpdate(mealIdx, { ...meal, foods: meal.foods.map((f, i) => i === foodIdx ? updated : f) });
  };

  const handleSaveName = () => {
    onUpdate(mealIdx, { ...meal, name: mealName || meal.name, time: mealTime });
    setEditingName(false);
  };

  // Food drag handlers
  const handleFoodDragStart = (e, idx) => {
    setDragFoodIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `food-${idx}`);
  };
  const handleFoodDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragFoodIdx !== null && idx !== dragFoodIdx) setDragOverFoodIdx(idx);
  };
  const handleFoodDrop = (e, idx) => {
    e.preventDefault();
    if (dragFoodIdx === null || dragFoodIdx === idx) { setDragFoodIdx(null); setDragOverFoodIdx(null); return; }
    const foods = [...(meal.foods || [])];
    const [moved] = foods.splice(dragFoodIdx, 1);
    foods.splice(idx, 0, moved);
    onUpdate(mealIdx, { ...meal, foods });
    setDragFoodIdx(null);
    setDragOverFoodIdx(null);
  };
  const handleFoodDragEnd = () => { setDragFoodIdx(null); setDragOverFoodIdx(null); };

  const mealTotals = (meal.foods || []).reduce((acc, f) => ({
    kcal: acc.kcal + (f.kcal || 0), p: acc.p + (f.p || 0), c: acc.c + (f.c || 0), f: acc.f + (f.f || 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  return (
    <Card
      style={{
        marginBottom: 12,
        opacity: isDraggingMeal ? 0.5 : 1,
        transition: 'opacity 0.15s',
      }}
      draggable
      onDragStart={e => onMealDragStart(e, mealIdx)}
      onDragOver={e => onMealDragOver(e, mealIdx)}
      onDrop={e => onMealDrop(e, mealIdx)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <DragGrip style={{ fontSize: 16 }} />
          {editingName ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <input className="form-inp" value={mealName} onChange={e => setMealName(e.target.value)}
                placeholder="Meal name" style={{ flex: 1, fontSize: 13 }} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
              <input className="form-inp" value={mealTime} onChange={e => setMealTime(e.target.value)}
                placeholder="Time" style={{ width: 70, fontSize: 13 }} />
              <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={handleSaveName}>
                <Icon name="check" size={10} />
              </button>
            </div>
          ) : (
            <div style={{ cursor: 'pointer' }} onClick={() => setEditingName(true)}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{meal.name} <Icon name="edit" size={10} style={{ opacity: 0.3 }} /></div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {meal.time || ''} · {Math.round(mealTotals.kcal)} kcal · P:{Math.round(mealTotals.p)} C:{Math.round(mealTotals.c)} F:{Math.round(mealTotals.f)}
              </div>
            </div>
          )}
        </div>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => onRemove(mealIdx)}>
          <Icon name="trash" size={11} />
        </button>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 20 }}></th><th>Food</th><th>Grams</th><th>Kcal</th><th>P</th><th>C</th><th>F</th><th></th>
          </tr>
        </thead>
        <tbody>
          {(meal.foods || []).map((food, fi) => (
            <tr
              key={fi}
              draggable
              onDragStart={e => { e.stopPropagation(); handleFoodDragStart(e, fi); }}
              onDragOver={e => { e.stopPropagation(); handleFoodDragOver(e, fi); }}
              onDrop={e => { e.stopPropagation(); handleFoodDrop(e, fi); }}
              onDragEnd={handleFoodDragEnd}
              style={{
                opacity: dragFoodIdx === fi ? 0.4 : 1,
                borderTop: dragOverFoodIdx === fi && dragFoodIdx !== null && dragFoodIdx > fi ? '2px solid var(--gold)' : 'none',
                borderBottom: dragOverFoodIdx === fi && dragFoodIdx !== null && dragFoodIdx < fi ? '2px solid var(--gold)' : 'none',
                transition: 'opacity 0.15s',
              }}
            >
              <td style={{ width: 20, padding: '0 4px' }}><DragGrip /></td>
              <td style={{ fontWeight: 500 }}>{food.fname}</td>
              <td>
                <input
                  className="form-inp"
                  type="number"
                  value={food.grams}
                  onChange={e => handleGramsChange(fi, e.target.value)}
                  style={{ width: 52, padding: '3px 5px', fontSize: 12, textAlign: 'center' }}
                  min="0"
                />
              </td>
              <td>{food.kcal}</td>
              <td style={{ color: 'var(--green)' }}>{food.p}</td>
              <td style={{ color: 'var(--blue)' }}>{food.c}</td>
              <td style={{ color: 'var(--orange)' }}>{food.f}</td>
              <td>
                <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => handleRemoveFood(fi)}>
                  <Icon name="x" size={9} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding ? (
        <FoodPicker onSelect={handleAddFood} onCancel={() => setAdding(false)} />
      ) : (
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>
          <Icon name="plus" size={12} /> Add Food
        </button>
      )}
    </Card>
  );
}

// ── Assign to client modal ──
function AssignPanel({ plan, onClose }) {
  const { clients } = useCoachStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (!selectedClientId) { showToast('Select a client', 'error'); return; }
    setSaving(true);
    const result = await saveMealPlan(selectedClientId, user.id, plan.meals || [], plan.name || 'Meal Plan');
    setSaving(false);
    if (result.ok) {
      showToast('Meal plan assigned!', 'success');
      onClose();
    } else {
      showToast(result.error || 'Failed to assign', 'error');
      console.error('[AssignPanel] Failed:', result.error);
    }
  };

  return (
    <Card style={{ marginTop: 14, border: '1px solid var(--gold)', borderColor: 'var(--gold)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="kl">Assign to Client</div>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose}>
          <Icon name="x" size={10} />
        </button>
      </div>
      {clients.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--t3)', padding: 10 }}>No clients found. Add clients first.</div>
      ) : (
        <>
          <select
            className="form-inp"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: '8px 10px', fontSize: 13 }}
          >
            <option value="">Select a client...</option>
            {clients.map(c => (
              <option key={c.client_id || c.id} value={c.client_id || c.id}>
                {c.client_name || c.name || 'Unknown'}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handleAssign} disabled={saving}>
            {saving ? 'Assigning...' : 'Assign Plan'}
          </button>
        </>
      )}
    </Card>
  );
}

// ── Empty state ──
function EmptyState() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
        <Icon name="utensils" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No nutrition plans yet</div>
        <div style={{ fontSize: 12 }}>Create a meal plan to assign to your clients.</div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════
// Main
// ══════════════════════════════════════
export default function NutritionEditorScreen() {
  const { nutritionTemplates, setNutritionTemplates } = useCoachStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const { markDirty, markClean } = useUnsavedWarning();
  const [activePlan, setActivePlan] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [planName, setPlanName] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetForm, setTargetForm] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [dragMealIdx, setDragMealIdx] = useState(null);
  const [dragOverMealIdx, setDragOverMealIdx] = useState(null);
  const [confirmRemoveMeal, setConfirmRemoveMeal] = useState(null); // mealIdx or null

  const plan = activePlan;

  // ── Meal drag handlers ──
  const handleMealDragStart = useCallback((e, idx) => {
    setDragMealIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `meal-${idx}`);
  }, []);

  const handleMealDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragMealIdx !== null && idx !== dragMealIdx) setDragOverMealIdx(idx);
  }, [dragMealIdx]);

  const handleMealDrop = useCallback((e, idx) => {
    e.preventDefault();
    if (!plan || dragMealIdx === null || dragMealIdx === idx) { setDragMealIdx(null); setDragOverMealIdx(null); return; }
    const meals = [...(plan.meals || [])];
    const [moved] = meals.splice(dragMealIdx, 1);
    meals.splice(idx, 0, moved);
    const updatedPlan = { ...plan, meals };
    setActivePlan(updatedPlan);
    setNutritionTemplates(nutritionTemplates.map(t => t.id === updatedPlan.id ? updatedPlan : t));
    setDragMealIdx(null);
    setDragOverMealIdx(null);
  }, [plan, dragMealIdx, nutritionTemplates, setNutritionTemplates]);

  const handleMealDragEnd = useCallback(() => { setDragMealIdx(null); setDragOverMealIdx(null); }, []);

  // ── Handlers ──
  const handleMealUpdate = (mealIdx, updated) => {
    if (!plan) return;
    const updatedPlan = { ...plan, meals: (plan.meals || []).map((m, i) => i === mealIdx ? updated : m) };
    setActivePlan(updatedPlan);
    setNutritionTemplates(nutritionTemplates.map(t => t.id === updatedPlan.id ? updatedPlan : t));
    markDirty();
  };

  const handleMealRemove = (mealIdx) => {
    setConfirmRemoveMeal(mealIdx);
  };

  const executeMealRemove = () => {
    if (!plan || confirmRemoveMeal === null) return;
    const updatedPlan = { ...plan, meals: (plan.meals || []).filter((_, i) => i !== confirmRemoveMeal) };
    setActivePlan(updatedPlan);
    setNutritionTemplates(nutritionTemplates.map(t => t.id === updatedPlan.id ? updatedPlan : t));
    markDirty();
    setConfirmRemoveMeal(null);
  };

  const handleAddMeal = () => {
    if (!plan) return;
    const mealNum = (plan.meals || []).length + 1;
    const updatedPlan = {
      ...plan,
      meals: [...(plan.meals || []), { name: `Meal ${mealNum}`, time: '', foods: [] }],
    };
    setActivePlan(updatedPlan);
    setNutritionTemplates(nutritionTemplates.map(t => t.id === updatedPlan.id ? updatedPlan : t));
    markDirty();
  };

  const [saving, setSaving] = useState(false);

  const handleNewPlan = async () => {
    const newPlan = {
      id: `new-${Date.now()}`,
      name: 'New Meal Plan',
      meals: [{ name: 'Meal 1', time: '08:00', foods: [] }],
      targets: { calories: 2400, protein: 180, carbs: 260, fat: 70 },
    };
    // Save to Supabase immediately
    const result = await saveNutritionTemplate(user.id, newPlan);
    if (result.ok && result.id) {
      newPlan.id = result.id; // Use real Supabase ID
    }
    setNutritionTemplates([...nutritionTemplates, newPlan]);
    setActivePlan(newPlan);
  };

  const handleSaveName = async () => {
    if (!plan || !planName.trim()) return;
    const updatedPlan = { ...plan, name: planName.trim() };
    setActivePlan(updatedPlan);
    setNutritionTemplates(nutritionTemplates.map(t => t.id === updatedPlan.id ? updatedPlan : t));
    setEditingName(false);
    await saveNutritionTemplate(user.id, updatedPlan);
  };

  const handleSaveTargets = async () => {
    if (!plan) return;
    const updatedPlan = {
      ...plan,
      targets: {
        calories: parseInt(targetForm.calories) || plan.targets?.calories || 0,
        protein: parseInt(targetForm.protein) || plan.targets?.protein || 0,
        carbs: parseInt(targetForm.carbs) || plan.targets?.carbs || 0,
        fat: parseInt(targetForm.fat) || plan.targets?.fat || 0,
      },
    };
    setActivePlan(updatedPlan);
    setNutritionTemplates(nutritionTemplates.map(t => t.id === updatedPlan.id ? updatedPlan : t));
    setEditingTargets(false);
    await saveNutritionTemplate(user.id, updatedPlan);
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    const result = await saveNutritionTemplate(user.id, plan);
    setSaving(false);
    if (result.ok) {
      // Update with real ID if it was a new plan
      if (result.id && result.id !== plan.id) {
        const updatedPlan = { ...plan, id: result.id };
        setActivePlan(updatedPlan);
        setNutritionTemplates(nutritionTemplates.map(t => t.id === plan.id ? updatedPlan : t));
      }
      markClean();
      showToast('Template saved!', 'success');
    } else {
      showToast(result.error || 'Failed to save', 'error');
    }
  };

  const handleDeletePlan = async () => {
    if (!plan) return;
    const isReal = plan.id && !String(plan.id).startsWith('new-');
    if (isReal) await deleteNutritionTemplate(plan.id);
    setNutritionTemplates(nutritionTemplates.filter(t => t.id !== plan.id));
    setActivePlan(null);
    showToast('Plan deleted', 'success');
  };

  // ══════════════════════════════════════
  // Plan editor view
  // ══════════════════════════════════════
  if (plan) {
    return (
      <div className="screen active">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <button className="icon-btn" onClick={() => { setActivePlan(null); setShowAssign(false); }}>
              <Icon name="chevron-left" size={14} />
            </button>
            {editingName ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                <input
                  className="form-inp"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="Plan name"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  style={{ flex: 1, fontSize: 15, fontWeight: 600 }}
                />
                <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={handleSaveName}>
                  <Icon name="check" size={10} />
                </button>
                <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => setEditingName(false)}>
                  <Icon name="x" size={10} />
                </button>
              </div>
            ) : (
              <div style={{ cursor: 'pointer' }} onClick={() => { setPlanName(plan.name); setEditingName(true); }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {plan.name} <Icon name="edit" size={10} style={{ opacity: 0.3 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{(plan.meals || []).length} meals · {plan.targets?.calories || 0} kcal target</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAssign(!showAssign)}>
              <Icon name="user" size={12} /> Assign
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveTemplate} disabled={saving}>
              <Icon name="check" size={12} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Assign panel */}
        {showAssign && (
          <AssignPanel plan={plan} onClose={() => setShowAssign(false)} />
        )}

        {/* Macro targets (editable) */}
        {editingTargets ? (
          <Card style={{ marginBottom: 18 }}>
            <div className="kl" style={{ marginBottom: 8 }}>Macro Targets</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'calories', label: 'Calories', unit: 'kcal' },
                { key: 'protein', label: 'Protein', unit: 'g' },
                { key: 'carbs', label: 'Carbs', unit: 'g' },
                { key: 'fat', label: 'Fat', unit: 'g' },
              ].map(t => (
                <div key={t.key} style={{ flex: '1 1 80px' }}>
                  <label style={{ fontSize: 10, color: 'var(--t3)' }}>{t.label} ({t.unit})</label>
                  <input
                    className="form-inp"
                    type="number"
                    value={targetForm[t.key]}
                    onChange={e => setTargetForm(prev => ({ ...prev, [t.key]: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveTargets}>Save Targets</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingTargets(false)}>Cancel</button>
            </div>
          </Card>
        ) : (
          <div style={{ position: 'relative' }}>
            <MacroSummary meals={plan.meals || []} targets={plan.targets || { calories: 0, protein: 0, carbs: 0, fat: 0 }} />
            <button
              className="btn btn-secondary btn-sm"
              style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', fontSize: 10 }}
              onClick={() => {
                setTargetForm({
                  calories: String(plan.targets?.calories || 0),
                  protein: String(plan.targets?.protein || 0),
                  carbs: String(plan.targets?.carbs || 0),
                  fat: String(plan.targets?.fat || 0),
                });
                setEditingTargets(true);
              }}
            >
              <Icon name="edit" size={9} /> Edit Targets
            </button>
          </div>
        )}

        {/* Meals */}
        {(plan.meals || []).map((meal, i) => (
          <div key={i} onDragEnd={handleMealDragEnd}
            style={{
              borderTop: dragOverMealIdx === i && dragMealIdx !== null && dragMealIdx > i ? '2px solid var(--gold)' : '2px solid transparent',
              borderBottom: dragOverMealIdx === i && dragMealIdx !== null && dragMealIdx < i ? '2px solid var(--gold)' : '2px solid transparent',
              borderRadius: 4,
              transition: 'border-color 0.15s',
            }}
          >
            <MealEditor
              meal={meal} mealIdx={i}
              onUpdate={handleMealUpdate} onRemove={handleMealRemove}
              onMealDragStart={handleMealDragStart}
              onMealDragOver={handleMealDragOver}
              onMealDrop={handleMealDrop}
              isDraggingMeal={dragMealIdx === i}
            />
          </div>
        ))}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={handleAddMeal}>
          <Icon name="plus" size={13} /> Add Meal
        </button>

        <ConfirmDialog
          open={confirmRemoveMeal !== null}
          title="Remove this meal?"
          message="All foods in this meal will be removed."
          confirmLabel="Remove"
          danger
          onConfirm={executeMealRemove}
          onCancel={() => setConfirmRemoveMeal(null)}
        />
      </div>
    );
  }

  // ══════════════════════════════════════
  // Plan list view
  // ══════════════════════════════════════
  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>{nutritionTemplates.length} plans</div>
        <button className="btn btn-primary btn-sm" onClick={handleNewPlan}>
          <Icon name="plus" size={12} /> New Plan
        </button>
      </div>

      {nutritionTemplates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="g2">
          {nutritionTemplates.map(t => (
            <Card key={t.id} style={{ cursor: 'pointer' }} onClick={() => setActivePlan(t)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: 'var(--gold-d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)',
                }}>
                  <Icon name="utensils" size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {(t.meals || []).length} meals · {t.targets?.calories || 0} kcal
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
