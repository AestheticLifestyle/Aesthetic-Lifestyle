import { useState, useMemo, useCallback } from 'react';
import { searchFoods, computeMacros, FOOD_CATEGORIES } from '../../data/foodDatabase';
import { Icon } from '../../utils/icons';
import { useT } from '../../i18n';

/**
 * Full-screen slide-up modal for searching & adding foods.
 * Props:
 *   open        — boolean
 *   onClose     — () => void
 *   onAddFood   — (food: { fname, grams, kcal, p, c, f, per100 }) => void
 *   mealName    — optional string shown in header ("Add to Breakfast")
 */
export default function AddFoodModal({ open, onClose, onAddFood, mealName }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedFood, setSelectedFood] = useState(null);
  const [grams, setGrams] = useState('100');
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customKcal, setCustomKcal] = useState('');
  const [customP, setCustomP] = useState('');
  const [customC, setCustomC] = useState('');
  const [customF, setCustomF] = useState('');

  const results = useMemo(() => {
    if (!query && category === 'All') return [];
    return searchFoods(query, category).slice(0, 40);
  }, [query, category]);

  const preview = useMemo(() => {
    if (!selectedFood) return null;
    return computeMacros(selectedFood, Number(grams) || 0);
  }, [selectedFood, grams]);

  const handleSelect = useCallback((food) => {
    setSelectedFood(food);
    setGrams('100');
    setCustomMode(false);
  }, []);

  const handleAdd = useCallback(() => {
    if (selectedFood && preview) {
      onAddFood({
        fname: preview.fname,
        grams: preview.grams,
        kcal: preview.kcal,
        p: preview.p,
        c: preview.c,
        f: preview.f,
        per100: selectedFood.per100,
      });
      // Reset & close
      setSelectedFood(null);
      setQuery('');
      onClose();
    }
  }, [selectedFood, preview, onAddFood, onClose]);

  const handleCustomAdd = useCallback(() => {
    const name = customName.trim();
    if (!name) return;
    const kcal = Number(customKcal) || 0;
    const p = Number(customP) || 0;
    const c = Number(customC) || 0;
    const f = Number(customF) || 0;
    onAddFood({
      fname: name,
      grams: 0,
      kcal, p, c, f,
      per100: null,
    });
    setCustomName('');
    setCustomKcal('');
    setCustomP('');
    setCustomC('');
    setCustomF('');
    setCustomMode(false);
    onClose();
  }, [customName, customKcal, customP, customC, customF, onAddFood, onClose]);

  const handleClose = useCallback(() => {
    setSelectedFood(null);
    setQuery('');
    setCategory('All');
    setCustomMode(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const cats = FOOD_CATEGORIES;

  return (
    <div className="afm-overlay" onClick={handleClose}>
      <div className="afm-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="afm-header">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>
              {mealName ? t('addTo', { meal: mealName }) : t('addFoodTitle')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
              {t('searchFromFoods')}
            </div>
          </div>
          <button className="icon-btn" onClick={handleClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Toggle: Search vs Custom */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', marginBottom: 12 }}>
          <button
            className={`chip ${!customMode ? 'active' : ''}`}
            onClick={() => { setCustomMode(false); setSelectedFood(null); }}
          >
            {t('searchDatabase')}
          </button>
          <button
            className={`chip ${customMode ? 'active' : ''}`}
            onClick={() => { setCustomMode(true); setSelectedFood(null); }}
          >
            {t('customEntry')}
          </button>
        </div>

        {!customMode ? (
          <>
            {/* Search bar */}
            <div className="afm-search">
              <Icon name="search" size={14} style={{ color: 'var(--t3)', flexShrink: 0 }} />
              <input
                className="search-input"
                placeholder={t('searchFood')}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedFood(null); }}
                autoFocus
              />
              {query && (
                <button className="icon-btn" onClick={() => { setQuery(''); setSelectedFood(null); }}>
                  <Icon name="x" size={10} />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="afm-cats">
              {cats.map(c => (
                <button
                  key={c}
                  className={`chip ${category === c ? 'active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Selected food — gram input + preview */}
            {selectedFood && preview && (
              <div className="afm-preview">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>
                  {selectedFood.name}
                </div>
                <div className="afm-gram-row">
                  <label style={{ fontSize: 12, color: 'var(--t3)' }}>{t('amountGrams')}</label>
                  <input
                    className="afm-gram-input"
                    type="number"
                    value={grams}
                    onChange={e => setGrams(e.target.value)}
                    min="1"
                    autoFocus
                  />
                </div>
                <div className="afm-macro-row">
                  <div className="afm-macro"><span className="afm-mv">{preview.kcal}</span><span className="afm-ml">kcal</span></div>
                  <div className="afm-macro"><span className="afm-mv" style={{ color: 'var(--green)' }}>{preview.p}g</span><span className="afm-ml">{t('protein').toLowerCase()}</span></div>
                  <div className="afm-macro"><span className="afm-mv" style={{ color: 'var(--blue)' }}>{preview.c}g</span><span className="afm-ml">{t('carbs').toLowerCase()}</span></div>
                  <div className="afm-macro"><span className="afm-mv" style={{ color: 'var(--orange)' }}>{preview.f}g</span><span className="afm-ml">{t('fat').toLowerCase()}</span></div>
                </div>
                {/* Quick gram buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[50, 100, 150, 200, 250].map(g => (
                    <button key={g} className={`chip ${Number(grams) === g ? 'active' : ''}`} onClick={() => setGrams(String(g))}>
                      {g}g
                    </button>
                  ))}
                </div>
                <button className="btn btn-p" style={{ width: '100%', marginTop: 12 }} onClick={handleAdd}>
                  {t('addFoodBtn', { name: preview.fname, kcal: preview.kcal })}
                </button>
              </div>
            )}

            {/* Results list */}
            {!selectedFood && (
              <div className="afm-list">
                {results.length === 0 && query.length > 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>
                    {t('noFoodsFoundSearch')}
                  </div>
                )}
                {results.length === 0 && query.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>
                    {t('startTypingSearch')}
                  </div>
                )}
                {results.map((food, i) => (
                  <div key={i} className="afm-food-row" onClick={() => handleSelect(food)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{food.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>
                        {food.per100.kcal} kcal · {t('protein').charAt(0)}:{food.per100.p} {t('carbs').charAt(0)}:{food.per100.c} {t('fat').charAt(0)}:{food.per100.f} <span style={{ opacity: 0.5 }}>{t('per100gLabel')}</span>
                      </div>
                    </div>
                    <div className="tag t-gy" style={{ fontSize: 9 }}>{food.cat}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Custom entry mode */
          <div className="afm-custom">
            <div className="afm-field">
              <label>{t('foodName')}</label>
              <input placeholder={t('foodNamePlaceholder')} value={customName} onChange={e => setCustomName(e.target.value)} autoFocus />
            </div>
            <div className="afm-custom-macros">
              <div className="afm-field">
                <label>{t('calories')}</label>
                <input type="number" placeholder="kcal" value={customKcal} onChange={e => setCustomKcal(e.target.value)} />
              </div>
              <div className="afm-field">
                <label>{t('proteinG')}</label>
                <input type="number" placeholder="0" value={customP} onChange={e => setCustomP(e.target.value)} />
              </div>
              <div className="afm-field">
                <label>{t('carbsG')}</label>
                <input type="number" placeholder="0" value={customC} onChange={e => setCustomC(e.target.value)} />
              </div>
              <div className="afm-field">
                <label>{t('fatG')}</label>
                <input type="number" placeholder="0" value={customF} onChange={e => setCustomF(e.target.value)} />
              </div>
            </div>
            <button
              className="btn btn-p"
              style={{ width: '100%', marginTop: 14 }}
              onClick={handleCustomAdd}
              disabled={!customName.trim()}
            >
              {t('addCustomFood')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
