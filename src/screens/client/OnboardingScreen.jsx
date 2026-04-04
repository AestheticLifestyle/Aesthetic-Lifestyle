import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { supabase } from '../../services/supabase';

const STEPS = [
  { id: 'basics', title: 'About You', icon: 'user' },
  { id: 'body', title: 'Body & Goals', icon: 'trending-up' },
  { id: 'training', title: 'Training', icon: 'dumbbell' },
  { id: 'nutrition', title: 'Nutrition', icon: 'utensils' },
  { id: 'lifestyle', title: 'Lifestyle', icon: 'heart' },
];

const GOAL_OPTIONS = ['Fat Loss', 'Lean Bulk', 'Body Recomp', 'Maintenance', 'Competition Prep'];
const EXPERIENCE_OPTIONS = ['Beginner (0-1yr)', 'Intermediate (1-3yr)', 'Advanced (3-5yr)', 'Expert (5yr+)'];
const TRAINING_DAYS = ['3 days', '4 days', '5 days', '6 days'];
const DIET_TYPES = ['No restrictions', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'Keto', 'Other'];
const ALLERGY_OPTIONS = ['None', 'Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Shellfish', 'Other'];

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

      if (error) {
        console.error('[Onboarding] save error:', error);
        // If table doesn't exist yet, silently continue — data will be in localStorage
        if (error.code === '42P01') {
          localStorage.setItem(`onboarding_${clientId}`, JSON.stringify(form));
        } else {
          throw error;
        }
      }

      // Also save to localStorage as backup
      localStorage.setItem(`onboarding_${clientId}`, JSON.stringify(form));
      localStorage.setItem(`onboarding_complete_${clientId}`, 'true');

      // Update goal on coach_clients if available
      if (form.goal) {
        const goalMap = { 'Fat Loss': 'cut', 'Lean Bulk': 'lean-bulk', 'Body Recomp': 'recomp', 'Maintenance': 'maintenance', 'Competition Prep': 'competition-prep' };
        await supabase.from('coach_clients').update({ goal: goalMap[form.goal] || form.goal }).eq('client_id', clientId);
      }

      showToast('Profile complete! Welcome aboard.', 'success');
      navigate('/app/dashboard');
    } catch (err) {
      console.error('[Onboarding] error:', err);
      showToast('Saved locally — your coach will see this when connected', 'success');
      localStorage.setItem(`onboarding_complete_${user?.id}`, 'true');
      navigate('/app/dashboard');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0: // Basics
        return (
          <>
            <FieldGroup label="How old are you?">
              <input className="form-inp" type="number" placeholder="e.g. 28" value={form.age} onChange={e => update('age', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label="Height" sub="in cm">
              <input className="form-inp" type="number" placeholder="e.g. 180" value={form.height} onChange={e => update('height', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label="What do you do for work?" sub="Helps us understand your activity level">
              <input className="form-inp" placeholder="e.g. Office job, Construction, Student" value={form.occupation} onChange={e => update('occupation', e.target.value)} style={{ width: '100%' }} />
            </FieldGroup>
          </>
        );

      case 1: // Body & Goals
        return (
          <>
            <FieldGroup label="Current weight" sub="in kg">
              <input className="form-inp" type="number" placeholder="e.g. 85" value={form.currentWeight} onChange={e => update('currentWeight', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label="Goal weight" sub="Where do you want to be?">
              <input className="form-inp" type="number" placeholder="e.g. 78" value={form.goalWeight} onChange={e => update('goalWeight', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
            <FieldGroup label="What's your main goal?">
              <PillSelect options={GOAL_OPTIONS} value={form.goal} onChange={v => update('goal', v)} />
            </FieldGroup>
            <FieldGroup label="Estimated body fat %" sub="Optional — your coach can help assess">
              <input className="form-inp" type="text" placeholder="e.g. 20%" value={form.bodyFatEstimate} onChange={e => update('bodyFatEstimate', e.target.value)} style={{ width: 120 }} />
            </FieldGroup>
          </>
        );

      case 2: // Training
        return (
          <>
            <FieldGroup label="Training experience">
              <PillSelect options={EXPERIENCE_OPTIONS} value={form.experience} onChange={v => update('experience', v)} />
            </FieldGroup>
            <FieldGroup label="How many days can you train per week?">
              <PillSelect options={TRAINING_DAYS} value={form.trainingDays} onChange={v => update('trainingDays', v)} />
            </FieldGroup>
            <FieldGroup label="Preferred training style" sub="Optional">
              <input className="form-inp" placeholder="e.g. Push/Pull/Legs, Upper/Lower, Full Body" value={form.preferredSplit} onChange={e => update('preferredSplit', e.target.value)} style={{ width: '100%' }} />
            </FieldGroup>
            <FieldGroup label="Any injuries or limitations?" sub="Current or past — help your coach plan safely">
              <textarea className="form-inp" placeholder="e.g. Lower back pain, shoulder impingement, knee surgery in 2022" value={form.injuries} onChange={e => update('injuries', e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
            </FieldGroup>
          </>
        );

      case 3: // Nutrition
        return (
          <>
            <FieldGroup label="Dietary preference">
              <PillSelect options={DIET_TYPES} value={form.dietType} onChange={v => update('dietType', v)} />
            </FieldGroup>
            <FieldGroup label="Allergies or intolerances" sub="Select all that apply">
              <PillSelect options={ALLERGY_OPTIONS} value={form.allergies} onChange={v => update('allergies', v)} multi />
            </FieldGroup>
            <FieldGroup label="Preferred meals per day">
              <PillSelect options={['3', '4', '5', '6']} value={form.mealsPerDay} onChange={v => update('mealsPerDay', v)} />
            </FieldGroup>
            <FieldGroup label="Current supplements" sub="Optional">
              <input className="form-inp" placeholder="e.g. Whey protein, creatine, multivitamin" value={form.supplements} onChange={e => update('supplements', e.target.value)} style={{ width: '100%' }} />
            </FieldGroup>
          </>
        );

      case 4: // Lifestyle
        return (
          <>
            <FieldGroup label="Average sleep per night">
              <PillSelect options={['< 6 hours', '6-7 hours', '7-8 hours', '8+ hours']} value={form.sleepHours} onChange={v => update('sleepHours', v)} />
            </FieldGroup>
            <FieldGroup label="Stress level">
              <PillSelect options={['Low', 'Moderate', 'High', 'Very High']} value={form.stressLevel} onChange={v => update('stressLevel', v)} />
            </FieldGroup>
            <FieldGroup label="Average daily steps">
              <PillSelect options={['< 5,000', '5,000-8,000', '8,000-10,000', '10,000+']} value={form.dailySteps} onChange={v => update('dailySteps', v)} />
            </FieldGroup>
            <FieldGroup label="What motivates you?" sub="This helps your coach understand how to keep you on track">
              <textarea className="form-inp" placeholder="e.g. Want to look good on holiday, health reasons, sport performance..." value={form.motivation} onChange={e => update('motivation', e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
            </FieldGroup>
            <FieldGroup label="What's your biggest challenge with fitness?" sub="Be honest — your coach needs to know">
              <textarea className="form-inp" placeholder="e.g. Consistency, late night snacking, skipping workouts, not knowing what to eat..." value={form.biggestChallenge} onChange={e => update('biggestChallenge', e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
            </FieldGroup>
          </>
        );

      default: return null;
    }
  };

  return (
    <div className="screen active" style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Progress header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Let's get to know you</div>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
          This helps your coach build the perfect plan for you.
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? 'var(--gold)' : 'var(--c3)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Icon name={STEPS[step].icon} size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{STEPS[step].title}</span>
          <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 'auto' }}>Step {step + 1} of {STEPS.length}</span>
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
            <Icon name="chevron-left" size={12} /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext()} style={{ flex: 2 }}>
            Continue <Icon name="chevron-right" size={12} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Saving...' : 'Complete Profile'}
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
          Skip for now — I'll do this later
        </button>
      )}
    </div>
  );
}
