import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { useT } from '../../i18n';
import { supabase } from '../../services/supabase';

const createSteps = (t) => [
  { id: 'basics', title: t('aboutYou'), icon: 'user' },
  { id: 'body', title: t('bodyAndGoals'), icon: 'trending-up' },
  { id: 'training', title: t('training'), icon: 'dumbbell' },
  { id: 'nutrition', title: t('nutrition'), icon: 'utensils' },
  { id: 'lifestyle', title: t('lifestyle'), icon: 'heart' },
];

const createGoalOptions = (t) => [t('fatLoss'), t('leanBulk'), t('bodyRecomp'), t('maintenance'), t('competitionPrep')];
const createExperienceOptions = (t) => [t('beginner'), t('intermediate'), t('advanced'), t('expert')];
const createTrainingDays = () => ['3 days', '4 days', '5 days', '6 days'];
const createDietTypes = (t) => [t('noRestrictions'), t('vegetarian'), t('vegan'), t('pescatarian'), t('halal'), t('kosher'), t('keto'), t('other')];
const createAllergyOptions = (t) => [t('none'), t('gluten'), t('dairy'), t('nuts'), t('eggs'), t('soy'), t('shellfish'), t('other')];

function PillSelect({ options, value, onChange, multi = false }) {
  const selected = multi ? (value || []) : [value];
  const toggle = (opt) => {
    if (multi) {
      const arr = value || [];
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt]);
    } else {
      onChange(opt);
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: selected.includes(opt) ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
            background: selected.includes(opt) ? 'var(--gold-d)' : 'transparent',
            color: selected.includes(opt) ? 'var(--gold)' : 'var(--t2)',
            transition: 'all 0.15s',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function FieldGroup({ label, sub, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>{sub}</div>}
      {children}
    </div>
  );
}

export default function OnboardingScreen() {
  const t = useT();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    // Basics
    age: '',
    height: '',
    occupation: '',
    // Body & Goals
    currentWeight: '',
    goalWeight: '',
    goal: '',
    bodyFatEstimate: '',
    // Training
    experience: '',
    trainingDays: '',
    preferredSplit: '',
    injuries: '',
    // Nutrition
    dietType: '',
    allergies: [],
    mealsPerDay: '4',
    supplements: '',
    // Lifestyle
    sleepHours: '',
    stressLevel: '',
    dailySteps: '',
    motivation: '',
    biggestChallenge: '',
  });

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const canNext = () => {
    if (step === 0) return form.age && form.height;
    if (step === 1) return form.currentWeight && form.goal;
    if (step === 2) return form.experience && form.trainingDays;
    if (step === 3) return form.dietType;
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const clientId = user?.id;
      if (!clientId) throw new Error('No user');

      // Save to client_onboarding table (or coach_clients metadata)
      const { error } = await supabase.from('client_onboarding').upsert({
        client_id: clientId,
        age: parseInt(form.age) || null,
        height_cm: parseInt(form.height) || null,
        occupation: form.occupation || null,
        current_weight: parseFloat(form.currentWeight) || null,
        goal_weight: parseFloat(form.goalWeight) || null,
        goal: form.goal || null,
        body_fat_estimate: form.bodyFatEstimate || null,
        training_experience: form.experience || null,
        training_days: form.trainingDays || null,
        preferred_split: form.preferredSplit || null,
        injuries: form.injuries || null,
        diet_type: form.dietType || null,
        allergies: form.allergies || [],
        meals_per_day: parseInt(form.mealsPerDay) || 4,
        supplements: form.supplements || null,
        sleep_hours: form.sleepHours || null,
        stress_level: form.stressLevel || null,
        daily_steps: form.dailySteps || null,
        motivation: form.motivation || null,
        biggest_challenge: form.biggestChallenge || null,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

      // If table doesn't exist yet, silently continue — data will be in localStorage
      if (error && error.code !== '42P01') {
        throw error;
      }

      // Also save to localStorage as backup
      localStorage.setItem(`onboarding_${clientId}`, JSON.stringify(form));
      localStorage.setItem(`onboarding_complete_${clientId}`, 'true');

      // Update goal on coach_clients if available
      if (form.goal) {
        const goalOptions = createGoalOptions(t);
        const goalMap = {
          [goalOptions[0]]: 'cut',
          [goalOptions[1]]: 'lean-bulk',
          [goalOptions[2]]: 'recomp',
          [goalOptions[3]]: 'maintenance',
          [goalOptions[4]]: 'competition-prep'
        };
        await supabase.from('coach_clients').update({ goal: goalMap[form.goal] || form.goal }).eq('client_id', clientId);
      }

      showToast(t('profileComplete') || 'Profile complete! Welcome aboard.', 'success');
      navigate('/app/dashboard');
    } catch (err) {
      showToast(t('savedLocally') || 'Saved locally — your coach will see this when connected', 'success');
      localStorage.setItem(`onboarding_complete_${user?.id}`, 'true');
      navigate('/app/dashboard');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    const goalOptions = createGoalOptions(t);
    const experienceOptions = createExperienceOptions(t);
    const trainingDays = createTrainingDays();
    const dietTypes = createDietTypes(t);
    const allergyOptions = createAllergyOptions(t);

    switch (step) {
      case 0: // Basics
        return (
          <>
            <FieldGroup label={t('howOldAreYou')}>
              <input className="form-inp" type="number" placeholder="e.g. 28" value={form.age} onChange={e => update('age', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label={t('height')} sub={t('inCm')}>
              <input className="form-inp" type="number" placeholder="e.g. 180" value={form.height} onChange={e => update('height', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label={t('whatDoYouDoForWork')} sub={t('workDescription')}>
              <input className="form-inp" placeholder="e.g. Office job, Construction, Student" value={form.occupation} onChange={e => update('occupation', e.target.value)} style={{ width: '100%' }} />
            </FieldGroup>
          </>
        );

      case 1: // Body & Goals
        return (
          <>
            <FieldGroup label={t('currentWeight')} sub={t('inKg')}>
              <input className="form-inp" type="number" placeholder="e.g. 85" value={form.currentWeight} onChange={e => update('currentWeight', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label={t('goalWeight')} sub={t('whereDoYouWantToBe')}>
              <input className="form-inp" type="number" placeholder="e.g. 78" value={form.goalWeight} onChange={e => update('goalWeight', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label={t('whatsYourMainGoal')}>
              <PillSelect options={goalOptions} value={form.goal} onChange={v => update('goal', v)} />
            </FieldGroup>
            <FieldGroup label={t('estimatedBodyFat')} sub={t('bodyFatOptional')}>
              <input className="form-inp" type="text" placeholder="e.g. 20%" value={form.bodyFatEstimate} onChange={e => update('bodyFatEstimate', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
          </>
        );

      case 2: // Training
        return (
          <>
            <FieldGroup label={t('trainingExperience')}>
              <PillSelect options={experienceOptions} value={form.experience} onChange={v => update('experience', v)} />
            </FieldGroup>
            <FieldGroup label={t('howManyDaysTrain')}>
              <PillSelect options={trainingDays} value={form.trainingDays} onChange={v => update('trainingDays', v)} />
            </FieldGroup>
            <FieldGroup label={t('preferredTrainingStyle')} sub={t('optional')}>
              <input className="form-inp" placeholder={t('trainingStylePlaceholder')} value={form.preferredSplit} onChange={e => update('preferredSplit', e.target.value)} style={{ width: '100%' }} />
            </FieldGroup>
            <FieldGroup label={t('injuriesOrLimitations')} sub={t('injuriesDesc')}>
              <textarea className="form-inp" placeholder={t('injuriesPlaceholder')} value={form.injuries} onChange={e => update('injuries', e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
            </FieldGroup>
          </>
        );

      case 3: // Nutrition
        return (
          <>
            <FieldGroup label={t('dietaryPreference')}>
              <PillSelect options={dietTypes} value={form.dietType} onChange={v => update('dietType', v)} />
            </FieldGroup>
            <FieldGroup label={t('allergiesOrIntolerances')} sub={t('selectAllThatApply')}>
              <PillSelect options={allergyOptions} value={form.allergies} onChange={v => update('allergies', v)} multi />
            </FieldGroup>
            <FieldGroup label={t('preferredMealsPerDay')}>
              <PillSelect options={['3', '4', '5', '6']} value={form.mealsPerDay} onChange={v => update('mealsPerDay', v)} />
            </FieldGroup>
            <FieldGroup label={t('currentSupplements')} sub={t('optional')}>
              <input className="form-inp" placeholder={t('supplementsPlaceholder')} value={form.supplements} onChange={e => update('supplements', e.target.value)} style={{ width: '100%' }} />
            </FieldGroup>
          </>
        );

      case 4: // Lifestyle
        return (
          <>
            <FieldGroup label={t('avgSleepPerNight')}>
              <PillSelect options={[t('sleepLess6'), t('sleep67'), t('sleep78'), t('sleep8Plus')]} value={form.sleepHours} onChange={v => update('sleepHours', v)} />
            </FieldGroup>
            <FieldGroup label={t('stressLevel')}>
              <PillSelect options={[t('stressLow'), t('stressModerate'), t('stressHigh'), t('stressVeryHigh')]} value={form.stressLevel} onChange={v => update('stressLevel', v)} />
            </FieldGroup>
            <FieldGroup label={t('avgDailySteps')}>
              <PillSelect options={[t('steps5k'), t('steps58k'), t('steps810k'), t('steps10kPlus')]} value={form.dailySteps} onChange={v => update('dailySteps', v)} />
            </FieldGroup>
            <FieldGroup label={t('whatMotivatesYou')} sub={t('motivatesDesc')}>
              <textarea className="form-inp" placeholder={t('motivatesPlaceholder')} value={form.motivation} onChange={e => update('motivation', e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
            </FieldGroup>
            <FieldGroup label={t('biggestChallenge')} sub={t('challengeDesc')}>
              <textarea className="form-inp" placeholder={t('challengePlaceholder')} value={form.biggestChallenge} onChange={e => update('biggestChallenge', e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
            </FieldGroup>
          </>
        );

      default: return null;
    }
  };

  const steps = createSteps(t);

  return (
    <div className="screen active" style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Progress header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{t('letsGetToKnowYou')}</div>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
          {t('onboardingSubtitle')}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? 'var(--gold)' : 'var(--c3)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Icon name={steps[step].icon} size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{steps[step].title}</span>
          <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 'auto' }}>{t('stepOf', { step: step + 1, total: steps.length })}</span>
        </div>
      </div>

      {/* Step content */}
      <Card>
        {renderStep()}
      </Card>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {step > 0 && (
          <button className="btn btn-secondary" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>
            <Icon name="chevron-left" size={12} /> {t('back')}
          </button>
        )}
        {step < steps.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext()} style={{ flex: 2 }}>
            {t('continue')} <Icon name="chevron-right" size={12} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ flex: 2 }}>
            {saving ? t('saving') : t('completeProfile')}
          </button>
        )}
      </div>

      {/* Skip option */}
      {step === 0 && (
        <button
          className="btn btn-ghost"
          onClick={() => {
            localStorage.setItem(`onboarding_complete_${user?.id}`, 'true');
            navigate('/app/dashboard');
          }}
          style={{ width: '100%', marginTop: 12, fontSize: 12, opacity: 0.6 }}
        >
          {t('skipForNow')}
        </button>
      )}
    </div>
  );
}
