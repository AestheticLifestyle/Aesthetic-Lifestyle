import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoachStore } from '../../stores/coachStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Card } from '../../components/ui';
import { Icon } from '../../utils/icons';
import { createInviteCode, fetchInviteCodes, deactivateInviteCode } from '../../services/invites';
import { fetchTrainingTemplates, fetchNutritionTemplates, fetchClients, updateClientSettings, archiveClient, reactivateClient, GOAL_LABELS } from '../../services/chat';

function ClientCard({ client, onClick }) {
  const isPending = client.isPending;
  const statusMap = {
    'on-track': { label: 'On Track', cls: 't-gr' },
    'attention': { label: 'Attention', cls: 't-or' },
    'at-risk': { label: 'At Risk', cls: 't-rd' },
    'pending': { label: 'Pending', cls: '' },
  };
  const status = client.status || 'on-track';
  const s = statusMap[status] || statusMap['on-track'];
  const name = client.client_name || client.name || 'Unknown';

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer', transition: 'border-color .15s',
        ...(isPending ? { borderStyle: 'dashed', opacity: 0.85 } : {}),
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: isPending ? 'var(--s3)' : 'var(--gold-d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isPending ? 'var(--t3)' : 'var(--gold)',
          fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 600,
        }}>
          {isPending ? '?' : name.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{client.goal || '—'}</div>
        </div>
        {isPending ? (
          <span style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
            color: 'var(--gold)', background: 'var(--gold-d)',
            padding: '3px 8px', borderRadius: 6,
          }}>
            Pending
          </span>
        ) : (
          <span className={`tag ${s.cls}`}>{s.label}</span>
        )}
      </div>

      {isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="link" size={11} style={{ color: 'var(--t3)' }} />
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>
              Code: <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, color: 'var(--gold)', letterSpacing: 1 }}>{client.code}</span>
            </span>
          </div>
          {client.clientSetup?.trainingPlan && (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              Training: {client.clientSetup.trainingPlan.name}
            </div>
          )}
          {client.clientSetup?.nutritionPlan && (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              Nutrition: {client.clientSetup.nutritionPlan.name}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4, fontStyle: 'italic' }}>
            Waiting for client to connect...
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div className="kl">Adherence</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--fd)', color: (client.adherence || 0) > 80 ? 'var(--green)' : (client.adherence || 0) > 60 ? 'var(--orange)' : 'var(--red)' }}>
                {client.adherence || 0}%
              </div>
            </div>
            <div>
              <div className="kl">Weight</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--fd)' }}>{client.weight ? `${client.weight} kg` : '—'}</div>
            </div>
            <div>
              <div className="kl">Streak</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--fd)', color: 'var(--gold)' }}>{client.streak || 0}d</div>
            </div>
          </div>

          {client.start_date && (
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 10 }}>
              Started: {(() => {
                try {
                  const dt = new Date(client.start_date + 'T00:00:00');
                  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                } catch { return client.start_date; }
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
        <Icon name="user" size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--t2)' }}>No clients yet</div>
        <div style={{ fontSize: 12 }}>Add your first client to get started with coaching.</div>
      </div>
    </Card>
  );
}

// ── Goal options ──
const GOALS = [
  { id: 'cut',        label: 'Cut',         icon: '🔥', desc: 'Fat loss focus' },
  { id: 'lean-bulk',  label: 'Lean Bulk',   icon: '💪', desc: 'Muscle gain — slight surplus' },
  { id: 'recomp',     label: 'Body Recomp', icon: '⚖️', desc: 'Lose fat + build muscle' },
  { id: 'maintenance',label: 'Maintenance',  icon: '🛡️', desc: 'Hold current physique' },
  { id: 'comp-prep',  label: 'Comp Prep',   icon: '🏆', desc: 'Contest / photoshoot prep' },
];

// ── Step indicator ──
function StepIndicator({ current, total, labels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, padding: '0 4px' }}>
      {labels.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < total - 1 ? 1 : 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
            background: i <= current ? 'var(--gold)' : 'var(--s3)',
            color: i <= current ? '#000' : 'var(--t3)',
            transition: 'all .2s',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div style={{
              flex: 1, height: 2, margin: '0 6px',
              background: i < current ? 'var(--gold)' : 'var(--s3)',
              transition: 'background .2s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Add Client Wizard (multi-step) ──
function AddClientWizard({ onClose, onCreated }) {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  // Wizard step
  const [step, setStep] = useState(0);
  const STEPS = ['Profile', 'Training', 'Nutrition', 'Review'];

  // Step 1: Profile
  const [clientName, setClientName] = useState('');
  const [goal, setGoal] = useState('maintenance');
  const [stepTarget, setStepTarget] = useState(10000);

  // Step 2: Training
  const [trainingTemplates, setTrainingTemplates] = useState([]);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Step 3: Nutrition
  const [nutritionTemplates, setNutritionTemplates] = useState([]);
  const [selectedNutrition, setSelectedNutrition] = useState(null);

  // Step 4: Result
  const [creating, setCreating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load templates when wizard opens
  useEffect(() => {
    if (!user?.id) return;
    setLoadingTemplates(true);
    Promise.all([
      fetchTrainingTemplates(user.id),
      fetchNutritionTemplates(user.id),
    ]).then(([training, nutrition]) => {
      setTrainingTemplates(training || []);
      setNutritionTemplates(nutrition || []);
      setLoadingTemplates(false);
    }).catch(() => setLoadingTemplates(false));
  }, [user?.id]);

  const canNext = () => {
    if (step === 0) return clientName.trim().length > 0;
    return true; // training & nutrition are optional
  };

  const handleGenerate = async () => {
    setCreating(true);
    try {
      const clientSetup = {
        clientName: clientName.trim(),
        goal,
        stepTarget,
      };

      // Attach training plan if selected
      if (selectedTraining) {
        clientSetup.trainingPlan = {
          name: selectedTraining.name,
          days: selectedTraining.days.map(d => ({
            name: d.name,
            exercises: d.exercises.map(ex => ({
              name: ex.name,
              sets: ex.sets,
              targetReps: ex.reps,
            })),
          })),
        };
      }

      // Attach nutrition plan if selected
      if (selectedNutrition) {
        clientSetup.nutritionPlan = {
          name: selectedNutrition.name,
          meals: selectedNutrition.meals,
        };
      }

      const result = await createInviteCode(user.id, {
        label: `For ${clientName.trim()}`,
        maxUses: 1,
        clientSetup,
      });

      setGeneratedCode(result.code);
      showToast('Client profile & invite code created!', 'success');
      if (onCreated) onCreated();
    } catch (err) {
      showToast('Failed to create invite code', 'error');
      console.error(err);
    }
    setCreating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render Steps ──
  const renderProfile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>
          Client Name *
        </label>
        <input
          type="text"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="Enter client's name"
          style={{ width: '100%', fontSize: 14 }}
          autoFocus
        />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8, display: 'block' }}>
          Training Goal
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GOALS.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: goal === g.id ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                background: goal === g.id ? 'var(--gold-d)' : 'var(--s2)',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 18 }}>{g.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: goal === g.id ? 'var(--gold)' : 'var(--t1)' }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{g.desc}</div>
              </div>
              {goal === g.id && (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="check" size={10} style={{ color: '#000' }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>
          Daily Step Target
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[8000, 10000, 12000, 15000].map(s => (
            <button
              key={s}
              type="button"
              className={`chip ${stepTarget === s ? 'active' : ''}`}
              onClick={() => setStepTarget(s)}
            >
              {s.toLocaleString()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTraining = () => (
    <div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
        Select a training plan template to assign, or skip to let the client start without one.
      </div>
      {loadingTemplates ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 12 }}>Loading templates...</div>
      ) : trainingTemplates.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 30, background: 'var(--s2)', borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <Icon name="dumbbell" size={24} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500, marginBottom: 4 }}>No training templates</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>Create templates in the Training section first.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Skip option */}
          <button
            type="button"
            onClick={() => setSelectedTraining(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: !selectedTraining ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              background: !selectedTraining ? 'var(--gold-d)' : 'var(--s2)',
              transition: 'all .15s',
            }}
          >
            <Icon name="minus" size={14} style={{ color: !selectedTraining ? 'var(--gold)' : 'var(--t3)' }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: !selectedTraining ? 'var(--gold)' : 'var(--t2)' }}>
              No training plan (skip)
            </div>
          </button>

          {trainingTemplates.map(t => {
            const isSelected = selectedTraining?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTraining(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: isSelected ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--gold-d)' : 'var(--s2)',
                  transition: 'all .15s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--gold)' : 'var(--t1)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                    {t.days.length} day{t.days.length !== 1 ? 's' : ''} — {t.days.map(d => d.name).join(', ')}
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="check" size={10} style={{ color: '#000' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderNutrition = () => (
    <div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
        Select a nutrition plan template, or skip to let the client start without one.
      </div>
      {loadingTemplates ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 12 }}>Loading templates...</div>
      ) : nutritionTemplates.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 30, background: 'var(--s2)', borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <Icon name="utensils" size={24} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500, marginBottom: 4 }}>No nutrition templates</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>Create templates in the Nutrition section first.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Skip option */}
          <button
            type="button"
            onClick={() => setSelectedNutrition(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: !selectedNutrition ? '1.5px solid var(--gold)' : '1px solid var(--border)',
              background: !selectedNutrition ? 'var(--gold-d)' : 'var(--s2)',
              transition: 'all .15s',
            }}
          >
            <Icon name="minus" size={14} style={{ color: !selectedNutrition ? 'var(--gold)' : 'var(--t3)' }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: !selectedNutrition ? 'var(--gold)' : 'var(--t2)' }}>
              No nutrition plan (skip)
            </div>
          </button>

          {nutritionTemplates.map(n => {
            const isSelected = selectedNutrition?.id === n.id;
            const t = n.targets || {};
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedNutrition(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: isSelected ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--gold-d)' : 'var(--s2)',
                  transition: 'all .15s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--gold)' : 'var(--t1)' }}>
                    {n.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                    {n.meals.length} meal{n.meals.length !== 1 ? 's' : ''}
                    {t.calories ? ` — ${Math.round(t.calories)} kcal` : ''}
                    {t.protein ? ` / ${Math.round(t.protein)}g P` : ''}
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="check" size={10} style={{ color: '#000' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderReview = () => {
    if (generatedCode) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: 'var(--gold)',
          }}>
            <Icon name="check" size={28} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Client Profile Ready!</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
            Share this code with {clientName}. When they sign up or enter it in Settings, everything will sync automatically.
          </div>

          <div style={{
            fontFamily: 'var(--fd)', fontSize: 32, fontWeight: 700, letterSpacing: 6,
            color: 'var(--gold)', padding: '16px 0', background: 'var(--s2)',
            borderRadius: 12, border: '1px solid rgba(212,175,55,.2)', marginBottom: 12,
          }}>
            {generatedCode}
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCopy}>
            <Icon name="copy" size={13} /> {copied ? 'Copied!' : 'Copy Invite Code'}
          </button>
        </div>
      );
    }

    const goalLabel = GOALS.find(g => g.id === goal)?.label || goal;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>
          Review the client profile before generating the invite code.
        </div>

        {/* Profile summary */}
        <div style={{
          background: 'var(--s2)', borderRadius: 12, padding: 14,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Profile
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Name</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{clientName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Goal</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gold)' }}>{goalLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Step Target</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{stepTarget.toLocaleString()}</span>
          </div>
        </div>

        {/* Training summary */}
        <div style={{
          background: 'var(--s2)', borderRadius: 12, padding: 14,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Training Plan
          </div>
          {selectedTraining ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{selectedTraining.name}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {selectedTraining.days.length} day{selectedTraining.days.length !== 1 ? 's' : ''}: {selectedTraining.days.map(d => d.name).join(', ')}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>None — will be assigned later</div>
          )}
        </div>

        {/* Nutrition summary */}
        <div style={{
          background: 'var(--s2)', borderRadius: 12, padding: 14,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Nutrition Plan
          </div>
          {selectedNutrition ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{selectedNutrition.name}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {selectedNutrition.meals.length} meals
                {selectedNutrition.targets?.calories ? ` — ${Math.round(selectedNutrition.targets.calories)} kcal` : ''}
                {selectedNutrition.targets?.protein ? ` / ${Math.round(selectedNutrition.targets.protein)}g P` : ''}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>None — will be assigned later</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--s1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520,
        maxHeight: '85vh', overflow: 'auto', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {generatedCode ? 'Invite Code Ready' : 'Add New Client'}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px', minWidth: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Step indicator */}
        {!generatedCode && <StepIndicator current={step} total={4} labels={STEPS} />}

        {/* Step content */}
        {step === 0 && renderProfile()}
        {step === 1 && renderTraining()}
        {step === 2 && renderNutrition()}
        {step === 3 && renderReview()}

        {/* Navigation buttons */}
        {!generatedCode && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {step > 0 && (
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
              >
                {step === 0 ? 'Next' : step === 1 ? 'Next' : 'Review'}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleGenerate}
                disabled={creating}
              >
                <Icon name="plus" size={12} /> {creating ? 'Creating...' : 'Generate Invite Code'}
              </button>
            )}
          </div>
        )}

        {generatedCode && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Existing Codes Modal (view/manage) ──
function CodesModal({ onClose }) {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchInviteCodes(user.id).then(data => {
        setCodes(data);
        setLoading(false);
      });
    }
  }, [user?.id]);

  const handleDeactivate = async (codeId) => {
    try {
      await deactivateInviteCode(codeId);
      setCodes(prev => prev.map(c => c.id === codeId ? { ...c, active: false } : c));
      showToast('Code deactivated', 'success');
    } catch {
      showToast('Failed to deactivate', 'error');
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--s1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Invite Codes</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px', minWidth: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>Loading...</div>
        ) : codes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 12 }}>
            No invite codes yet. Use "Add Client" to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {codes.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--border)',
                opacity: c.active ? 1 : 0.4,
              }}>
                <div style={{
                  fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 700, letterSpacing: 2,
                  color: c.active ? 'var(--gold)' : 'var(--t3)', flex: 1,
                }}>
                  {c.code}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'right', minWidth: 60 }}>
                  {c.label && <div>{c.label}</div>}
                  <div>{c.used_count}/{c.max_uses} used</div>
                </div>
                {c.active && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', minWidth: 0, fontSize: 10 }}
                      onClick={() => handleCopy(c.code)}
                    >
                      {copied === c.code ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', minWidth: 0, fontSize: 10, color: 'var(--red)' }}
                      onClick={() => handleDeactivate(c.id)}
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </>
                )}
                {!c.active && (
                  <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>Inactive</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: 16, padding: '10px 12px', background: 'rgba(212,175,55,.06)',
          borderRadius: 8, border: '1px solid rgba(212,175,55,.15)',
          fontSize: 11, color: 'var(--t3)', lineHeight: 1.5,
        }}>
          Share the invite code with your client. They can enter it during signup or in their Settings to connect with you.
        </div>
      </div>
    </div>
  );
}

// ── Pending Client Detail Modal ──
function PendingClientModal({ client, onClose }) {
  const { showToast } = useUIStore();
  const [copied, setCopied] = useState(false);
  const setup = client.clientSetup || {};
  const goalLabel = GOALS.find(g => g.id === setup.goal)?.label || setup.goal || '—';

  const handleCopy = () => {
    navigator.clipboard.writeText(client.code);
    setCopied(true);
    showToast('Code copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--s1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Pending Client</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px', minWidth: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Status banner */}
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          background: 'var(--gold-d)', border: '1px solid rgba(212,175,55,.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'var(--gold)' }}>Waiting for client to sign up and enter their invite code</div>
        </div>

        {/* Profile info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--s2)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Profile</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>Name</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{setup.clientName || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>Goal</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gold)' }}>{goalLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>Step Target</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{(setup.stepTarget || 10000).toLocaleString()}</span>
            </div>
          </div>

          {setup.trainingPlan && (
            <div style={{ background: 'var(--s2)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Training Plan</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{setup.trainingPlan.name}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {setup.trainingPlan.days?.length || 0} days: {(setup.trainingPlan.days || []).map(d => d.name).join(', ')}
              </div>
            </div>
          )}

          {setup.nutritionPlan && (
            <div style={{ background: 'var(--s2)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Nutrition Plan</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{setup.nutritionPlan.name}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {setup.nutritionPlan.meals?.length || 0} meals
              </div>
            </div>
          )}
        </div>

        {/* Invite code */}
        <div style={{
          marginTop: 16, textAlign: 'center', padding: 16,
          background: 'var(--s2)', borderRadius: 12, border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>Invite Code</div>
          <div style={{
            fontFamily: 'var(--fd)', fontSize: 28, fontWeight: 700, letterSpacing: 6,
            color: 'var(--gold)', marginBottom: 10,
          }}>
            {client.code}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleCopy} style={{ width: '100%' }}>
            <Icon name="copy" size={12} /> {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// Client Manage Panel (slide-out)
// ══════════════════════════════════════
const GOAL_OPTIONS = [
  { value: 'cut', label: 'Cut' },
  { value: 'lean-bulk', label: 'Lean Bulk' },
  { value: 'recomp', label: 'Body Recomp' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'comp-prep', label: 'Comp Prep' },
];

function ClientManagePanel({ client, onClose, onUpdated, onArchived }) {
  const { showToast } = useUIStore();
  const { user } = useAuthStore();
  const clientId = client?.client_id || client?.id;
  const clientName = client?.client_name || client?.name || 'Client';

  // Editable fields
  const [goal, setGoal] = useState(client?.goal || 'maintenance');
  const [stepTarget, setStepTarget] = useState(client?.step_target || 10000);
  const [targetWeight, setTargetWeight] = useState(client?.target_weight || '');
  const [calorieTarget, setCalorieTarget] = useState(client?.calorie_target || '');
  const [proteinTarget, setProteinTarget] = useState(client?.protein_target || '');
  const [carbTarget, setCarbTarget] = useState(client?.carb_target || '');
  const [fatTarget, setFatTarget] = useState(client?.fat_target || '');
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (!client) return null;

  const handleSave = async () => {
    setSaving(true);
    const result = await updateClientSettings(user?.id, clientId, {
      goal,
      step_target: parseInt(stepTarget) || 10000,
      target_weight: targetWeight ? parseFloat(targetWeight) : null,
      calorie_target: calorieTarget ? parseInt(calorieTarget) : null,
      protein_target: proteinTarget ? parseInt(proteinTarget) : null,
      carb_target: carbTarget ? parseInt(carbTarget) : null,
      fat_target: fatTarget ? parseInt(fatTarget) : null,
    });
    setSaving(false);
    if (result.ok) {
      showToast('Client settings saved', 'success');
      onUpdated?.({ ...client, goal, step_target: parseInt(stepTarget) || 10000,
        target_weight: targetWeight ? parseFloat(targetWeight) : null,
        calorie_target: calorieTarget ? parseInt(calorieTarget) : null,
        protein_target: proteinTarget ? parseInt(proteinTarget) : null,
        carb_target: carbTarget ? parseInt(carbTarget) : null,
        fat_target: fatTarget ? parseInt(fatTarget) : null,
      });
    } else {
      showToast(result.error || 'Failed to save', 'error');
    }
  };

  const handleArchive = async () => {
    const ok = await archiveClient(user?.id, clientId);
    if (ok) {
      showToast(`${clientName} archived`, 'success');
      onArchived?.(clientId);
      onClose();
    } else {
      showToast('Failed to archive client', 'error');
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--s1)',
    color: 'var(--t1)', fontSize: 13, fontFamily: 'var(--fm)',
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4, display: 'block' };
  const fieldGroup = { marginBottom: 14 };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 92vw)', background: 'var(--s0)', borderLeft: '1px solid var(--border)', zIndex: 300, display: 'flex', flexDirection: 'column', animation: 'slideIn .25s ease' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{clientName}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>Client Settings</div>
        </div>
        <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Goal */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Goal</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GOAL_OPTIONS.map(g => (
              <button key={g.value}
                onClick={() => setGoal(g.value)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: goal === g.value ? '1px solid var(--gold)' : '1px solid var(--border)',
                  background: goal === g.value ? 'var(--gold-d)' : 'transparent',
                  color: goal === g.value ? 'var(--gold)' : 'var(--t2)',
                  fontWeight: goal === g.value ? 600 : 400,
                }}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Weight */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Target Weight (kg)</label>
          <input type="number" style={inputStyle} value={targetWeight}
            onChange={e => setTargetWeight(e.target.value)}
            placeholder="e.g. 80" />
        </div>

        {/* Step Target */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Daily Step Target</label>
          <input type="number" style={inputStyle} value={stepTarget}
            onChange={e => setStepTarget(e.target.value)}
            placeholder="10000" />
        </div>

        {/* Macro Targets */}
        <div style={{ ...fieldGroup, marginTop: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 10 }}>Macro Targets</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ ...labelStyle, fontSize: 10, color: 'var(--t3)' }}>Calories (kcal)</label>
              <input type="number" style={inputStyle} value={calorieTarget}
                onChange={e => setCalorieTarget(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 10, color: 'var(--t3)' }}>Protein (g)</label>
              <input type="number" style={inputStyle} value={proteinTarget}
                onChange={e => setProteinTarget(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 10, color: 'var(--t3)' }}>Carbs (g)</label>
              <input type="number" style={inputStyle} value={carbTarget}
                onChange={e => setCarbTarget(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 10, color: 'var(--t3)' }}>Fat (g)</label>
              <input type="number" style={inputStyle} value={fatTarget}
                onChange={e => setFatTarget(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>

        {/* Info */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)' }}>
            <span>Start Date</span>
            <span>{client.start_date || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
            <span>Program</span>
            <span>Week {client.program_week || 1} / {client.total_weeks || 12}</span>
          </div>
          {client.adherence != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
              <span>Adherence</span>
              <span style={{ color: client.adherence >= 70 ? 'var(--green)' : client.adherence >= 40 ? 'var(--gold)' : 'var(--red, #e74c3c)' }}>{client.adherence}%</span>
            </div>
          )}
        </Card>

        {/* Danger zone — Archive */}
        <div style={{ marginTop: 24, padding: 16, borderRadius: 10, border: '1px solid var(--red, rgba(231,76,60,0.3))', background: 'rgba(231,76,60,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red, #e74c3c)', marginBottom: 6 }}>Archive Client</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5, marginBottom: 10 }}>
            This hides {clientName} from your active clients list. All data is preserved and you can reactivate them anytime from the "Archived" tab.
          </div>
          {!confirmArchive ? (
            <button className="btn btn-sm" onClick={() => setConfirmArchive(true)}
              style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--red, #e74c3c)', border: '1px solid var(--red, rgba(231,76,60,0.3))' }}>
              <Icon name="archive" size={12} /> Archive {clientName}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={handleArchive}
                style={{ background: 'var(--red, #e74c3c)', color: '#fff', flex: 1 }}>
                Confirm Archive
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmArchive(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer — Save */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving} onClick={handleSave}>
          <Icon name="check" size={12} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// Archived Client Card (minimal)
// ══════════════════════════════════════
function ArchivedClientCard({ client, onReactivate }) {
  const [loading, setLoading] = useState(false);
  const name = client.client_name || client.name || 'Client';
  const handleReactivate = async () => {
    setLoading(true);
    const ok = await onReactivate(client.client_id || client.id);
    setLoading(false);
  };
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--t3)' }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>{GOAL_LABELS[client.goal] || client.goal || 'No goal'} · Archived</div>
        </div>
        <button className="btn btn-sm btn-secondary" disabled={loading} onClick={handleReactivate}>
          <Icon name="refresh-cw" size={11} /> {loading ? '...' : 'Reactivate'}
        </button>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════
// Main
// ══════════════════════════════════════
export default function ClientsScreen() {
  const { clients, setClients } = useCoachStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [pendingClient, setPendingClient] = useState(null);
  const [manageClient, setManageClient] = useState(null);
  const [archivedClients, setArchivedClients] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const filtered = clients.filter(c => {
    if (filter === 'archived') return false; // archived shown separately
    const name = (c.client_name || c.name || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchFilter = filter === 'all'
      || (c.isPending && filter === 'pending')
      || (!c.isPending && (c.status || 'on-track') === filter);
    return matchSearch && matchFilter;
  });

  // Load archived clients when that tab is selected
  useEffect(() => {
    if (filter !== 'archived' || !user?.id) return;
    setLoadingArchived(true);
    fetchClients(user.id, { includeArchived: true }).then(all => {
      // archived = all clients that have archived=true
      setArchivedClients((all || []).filter(c => c.archived));
      setLoadingArchived(false);
    }).catch(() => setLoadingArchived(false));
  }, [filter, user?.id]);

  const handleClientClick = (client) => {
    if (client.isPending) {
      setPendingClient(client);
      return;
    }
    const id = client.client_id || client.id;
    navigate(`/coach/clients/${id}`);
  };

  const handleManageClick = (client, e) => {
    e.stopPropagation();
    setManageClient(client);
  };

  const handleClientUpdated = (updatedClient) => {
    setClients(clients.map(c =>
      (c.client_id || c.id) === (updatedClient.client_id || updatedClient.id)
        ? { ...c, ...updatedClient } : c
    ));
  };

  const handleClientArchived = (clientId) => {
    setClients(clients.filter(c => (c.client_id || c.id) !== clientId));
  };

  const handleReactivate = async (clientId) => {
    const ok = await reactivateClient(user?.id, clientId);
    if (ok) {
      showToast('Client reactivated', 'success');
      setArchivedClients(prev => prev.filter(c => (c.client_id || c.id) !== clientId));
      // Re-fetch active clients so they reappear
      fetchClients(user.id).then(data => setClients(data || []));
    } else {
      showToast('Failed to reactivate', 'error');
    }
    return ok;
  };

  return (
    <div className="screen active">
      {showWizard && <AddClientWizard onClose={() => setShowWizard(false)} />}
      {showCodes && <CodesModal onClose={() => setShowCodes(false)} />}
      {pendingClient && <PendingClientModal client={pendingClient} onClose={() => setPendingClient(null)} />}
      {manageClient && (
        <ClientManagePanel
          client={manageClient}
          onClose={() => setManageClient(null)}
          onUpdated={handleClientUpdated}
          onArchived={handleClientArchived}
        />
      )}

      {/* Search & filters + Add Client button */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowWizard(true)}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Icon name="plus" size={12} /> Add Client
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowCodes(true)}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Icon name="link" size={12} /> Invite Codes
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <Icon name="search" size={14} style={{ color: 'var(--t3)' }} />
          <input
            className="search-input"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'on-track', label: 'On Track' },
            { key: 'attention', label: 'Attention' },
            { key: 'at-risk', label: 'At Risk' },
            { key: 'archived', label: 'Archived' },
          ].map(f => (
            <button
              key={f.key}
              className={`chip ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client grid or archived list */}
      {filter === 'archived' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingArchived ? (
            <Card><div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>Loading archived clients...</div></Card>
          ) : archivedClients.length === 0 ? (
            <Card><div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
              <Icon name="archive" size={24} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13 }}>No archived clients</div>
            </div></Card>
          ) : (
            archivedClients.map(c => (
              <ArchivedClientCard
                key={c.client_id || c.id}
                client={c}
                onReactivate={handleReactivate}
              />
            ))
          )}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="g3">
            {filtered.map(c => (
              <div key={c.client_id || c.id} style={{ position: 'relative' }}>
                <ClientCard
                  client={c}
                  onClick={() => handleClientClick(c)}
                />
                {!c.isPending && (
                  <button
                    className="icon-btn"
                    title="Client Settings"
                    onClick={(e) => handleManageClick(c, e)}
                    style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, opacity: 0.5 }}
                  >
                    <Icon name="settings" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {filtered.length === 0 && clients.length > 0 && (
            <Card>
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                No clients match your search.
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
