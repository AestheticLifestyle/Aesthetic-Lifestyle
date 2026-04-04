import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useClientStore } from '../../stores/clientStore';
import { useUIStore } from '../../stores/uiStore';
import { Card, ProgressRing, DateNavigator } from '../../components/ui';
import { Icon } from '../../utils/icons';
import AddFoodModal from '../../components/nutrition/AddFoodModal';

// ---------- Macro bar ----------
function MacroBar({ label, current, target, color }) {
  const pct = target ? Math.min(current / target, 1) : 0;
  return (
    <div className="mac-item">
      <div className="mac-dot" style={{ background: color }} />
      <div className="mac-name">{label}</div>
      <div className="mac-bar">
        <div className="mac-fill" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <div className="mac-amt">{current}g / {target}g</div>
    </div>
  );
}

// ---------- Inline gram editor ----------
function GramEditor({ food, onSave, onCancel }) {
  const [grams, setGrams] = useState(String(food.grams || 0));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const val = Math.max(0, Math.round(Number(grams) || 0));
    onSave(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };

  // Quick gram presets
  const origGrams = food._origGrams || food.grams;
  const presets = [
    Math.round(origGrams * 0.5),
    origGrams,
    Math.round(origGrams * 1.5),
    Math.round(origGrams * 2),
  ].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <div className="gram-editor" onClick={(e) => e.stopPropagation()}>
      <div className="gram-editor-row">
        <input
          ref={inputRef}
          type="number"
          className="gram-input"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          onKeyDown={handleKeyDown}
          min="0"
          step="5"
        />
        <span className="gram-unit">g</span>
        <button className="gram-save-btn" onClick={handleSave}>
          <Icon name="check" size={12} />
        </button>
        <button className="gram-cancel-btn" onClick={onCancel}>
          <Icon name="x" size={12} />
        </button>
      </div>
      <div className="gram-presets">
        {presets.map(g => (
          <button
            key={g}
            className={`gram-preset ${Number(grams) === g ? 'active' : ''}`}
            onClick={() => setGrams(String(g))}
          >
            {g}g
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Food item row ----------
function FoodItem({ food, mealIdx, foodIdx, isExtra }) {
  const { toggleFoodCheck, toggleExtraFoodCheck, removeExtraFood, removePlanFood, restorePlanFood, updateFoodGrams } = useClientStore();
  const [editing, setEditing] = useState(false);
  const isRemoved = food._removed;
  const hasGramOverride = food._origGrams != null && food.grams !== food._origGrams;

  const handleCheck = () => {
    if (isRemoved || editing) return;
    if (isExtra) {
      toggleExtraFoodCheck(food._extraIdx);
    } else {
      toggleFoodCheck(mealIdx, foodIdx);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (isExtra) {
      removeExtraFood(food._extraIdx);
    } else {
      removePlanFood(food._mealIdx, food._planFoodIdx);
    }
  };

  const handleRestore = (e) => {
    e.stopPropagation();
    restorePlanFood(food._mealIdx, food._planFoodIdx);
  };

  const handleGramSave = (newGrams) => {
    if (!isExtra) {
      updateFoodGrams(food._mealIdx, food._planFoodIdx, newGrams);
    }
    setEditing(false);
  };

  const handleGramClick = (e) => {
    e.stopPropagation();
    if (!isRemoved && !isExtra) {
      setEditing(true);
    }
  };

  // Removed plan food — show as struck-through with restore option
  if (isRemoved) {
    return (
      <div className="ci removed">
        <div className="cb" style={{ opacity: 0.2 }} />
        <div style={{ flex: 1, opacity: 0.4 }}>
          <div className="ct" style={{ textDecoration: 'line-through' }}>{food.fname}</div>
          <div className="cm2">
            {food._origGrams || food.grams}g · {food._origKcal || food.kcal} kcal
          </div>
        </div>
        <button className="afm-restore-btn" onClick={handleRestore} aria-label="Restore">
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className={`ci ${food.checked ? 'done' : ''}`}>
      <div className="cb" onClick={handleCheck}>
        {food.checked && <Icon name="check" size={10} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }} onClick={handleCheck}>
        <div className="ct">
          {food.fname}
          {isExtra && <span className="tag t-bl" style={{ marginLeft: 6, fontSize: 8, padding: '1px 5px' }}>added</span>}
          {hasGramOverride && <span className="tag t-or" style={{ marginLeft: 6, fontSize: 8, padding: '1px 5px' }}>edited</span>}
        </div>

        {editing ? (
          <GramEditor food={food} onSave={handleGramSave} onCancel={() => setEditing(false)} />
        ) : (
          <div className="cm2">
            {food.grams > 0 && (
              <span
                className={`food-grams ${!isExtra ? 'editable' : ''}`}
                onClick={!isExtra ? handleGramClick : undefined}
              >
                {food.grams}g
              </span>
            )}
            {food.grams > 0 && ' · '}
            {food.kcal} kcal · P:{food.p} C:{food.c} F:{food.f}
          </div>
        )}
      </div>
      <button
        className="food-delete-btn"
        onClick={handleRemove}
        aria-label="Remove"
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

// ---------- Meal card ----------
function MealCard({ meal, mealIdx, onAddFood }) {
  const { logMeal } = useClientStore();
  const { showToast } = useUIStore();
  const planFoods = meal.foods?.filter(f => !f.addedByClient) || [];
  const allPlanChecked = planFoods.length > 0 && planFoods.every(f => f.checked);

  const mealMacros = useMemo(() => {
    let kcal = 0, p = 0, c = 0, f = 0;
    (meal.foods || []).forEach(fd => {
      if (fd.checked && !fd._removed) { kcal += fd.kcal || 0; p += fd.p || 0; c += fd.c || 0; f += fd.f || 0; }
    });
    return { kcal, p, c, f };
  }, [meal.foods]);

  const handleLogAll = () => {
    logMeal(mealIdx);
    showToast(`${meal.name} logged`, 'success');
  };

  const isQuickAdd = meal._isQuickAdd;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
            {isQuickAdd && <Icon name="plus" size={12} style={{ marginRight: 6, opacity: 0.5 }} />}
            {meal.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
            {meal.time ? `${meal.time} · ` : ''}{mealMacros.kcal} kcal
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isQuickAdd && meal.logged && <span className="tag t-gr">Logged</span>}
          {!isQuickAdd && !meal.logged && (
            <button className="btn btn-green btn-sm" onClick={handleLogAll}>
              Log All
            </button>
          )}
        </div>
      </div>

      {(meal.foods || []).map((food, fi) => (
        <FoodItem
          key={fi}
          food={food}
          mealIdx={mealIdx}
          foodIdx={fi}
          isExtra={!!food.addedByClient}
        />
      ))}

      {/* Add food button */}
      <button
        className="afm-add-btn"
        onClick={() => onAddFood(isQuickAdd ? null : mealIdx, meal.name)}
      >
        <Icon name="plus" size={11} />
        <span>Add food</span>
      </button>
    </Card>
  );
}

// ---------- Main ----------
export default function NutritionScreen() {
  const { macroTargets, getMealsForDate, getExtraFoodsForDate, addExtraFood } = useClientStore();
  const meals = getMealsForDate();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMealIdx, setModalMealIdx] = useState(null);
  const [modalMealName, setModalMealName] = useState('');

  const handleOpenAdd = useCallback((mealIdx, mealName) => {
    setModalMealIdx(mealIdx);
    setModalMealName(mealName || '');
    setModalOpen(true);
  }, []);

  const handleAddFood = useCallback((food) => {
    addExtraFood(food, modalMealIdx);
  }, [addExtraFood, modalMealIdx]);

  // Calculate totals from checked foods (plan + extra), excluding removed plan foods
  const totals = useMemo(() => {
    let kcal = 0, p = 0, c = 0, f = 0;
    meals.forEach(m => {
      (m.foods || []).forEach(fd => {
        if (fd.checked && !fd._removed) { kcal += fd.kcal || 0; p += fd.p || 0; c += fd.c || 0; f += fd.f || 0; }
      });
    });
    return { kcal, p, c, f };
  }, [meals]);

  const loggedMeals = meals.filter(m => m.logged).length;
  const planMeals = meals.filter(m => !m._isQuickAdd);

  return (
    <div className="screen active">
      {/* Date navigation */}
      <DateNavigator />

      {/* Overview card */}
      <Card className="mb-14">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="kl">Daily Nutrition</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
              <span className="kv" style={{ color: 'var(--gold)' }}>{totals.kcal}</span>
              <span className="ku">/ {macroTargets.calories} kcal</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
              {loggedMeals}/{planMeals.length} meals logged
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { label: 'P', val: totals.p, max: macroTargets.protein, color: 'var(--green)' },
              { label: 'C', val: totals.c, max: macroTargets.carbs, color: 'var(--blue)' },
              { label: 'F', val: totals.f, max: macroTargets.fat, color: 'var(--orange)' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <ProgressRing value={m.val} max={m.max} size={48} stroke={3.5} color={m.color}>
                  <span style={{ fontSize: 10 }}>{m.val}</span>
                </ProgressRing>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3, letterSpacing: 1 }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Macro bars */}
        <MacroBar label="Protein" current={totals.p} target={macroTargets.protein} color="var(--green)" />
        <MacroBar label="Carbs" current={totals.c} target={macroTargets.carbs} color="var(--blue)" />
        <MacroBar label="Fat" current={totals.f} target={macroTargets.fat} color="var(--orange)" />
      </Card>

      {/* Meal cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {meals.length === 0 ? (
          <>
            <Card>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Icon name="utensils" size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No Meal Plan</div>
                <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
                  Your coach hasn't assigned a meal plan yet.
                </div>
                <button className="btn btn-p" onClick={() => handleOpenAdd(null, 'Quick Add')}>
                  <Icon name="plus" size={12} /> Log a meal
                </button>
              </div>
            </Card>
          </>
        ) : (
          meals.map((meal, idx) => (
            <MealCard key={idx} meal={meal} mealIdx={idx} onAddFood={handleOpenAdd} />
          ))
        )}

        {/* Quick Add button when there IS a plan but no quick-add section yet */}
        {meals.length > 0 && !meals.some(m => m._isQuickAdd) && (
          <button
            className="afm-quick-add-btn"
            onClick={() => handleOpenAdd(null, 'Quick Add')}
          >
            <Icon name="plus" size={13} />
            <span>Quick Add Food</span>
          </button>
        )}
      </div>

      {/* Add Food Modal */}
      <AddFoodModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddFood={handleAddFood}
        mealName={modalMealName}
      />
    </div>
  );
}
