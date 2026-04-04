import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vnahttyexvtanbsezksp.supabase.co',
  'sb_publishable_1XL8uTWj1ZmsFS24AUx-IQ_edvHz8R9'
);

// Find the coach user
const { data: coaches, error: coachErr } = await supabase
  .from('profiles').select('id, full_name, role').eq('role', 'coach');

if (coachErr || !coaches?.length) {
  console.error('No coach found:', coachErr);
  process.exit(1);
}

const coachId = coaches[0].id;
console.log(`Coach: ${coaches[0].full_name} (${coachId})`);

// ═══════════════════════════════════════════
// TRAINING TEMPLATES (client_id = null)
// ═══════════════════════════════════════════

async function createTrainingTemplate(name, days) {
  const { data: plan, error } = await supabase.from('training_plans').insert({
    client_id: null, coach_id: coachId, name, is_active: true,
  }).select('id').single();
  if (error) { console.error(`ERR Plan "${name}":`, error.message); return; }

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const { data: dayRow } = await supabase.from('training_plan_days').insert({
      training_plan_id: plan.id, name: day.name, day_of_week: di, sort_order: di,
    }).select('id').single();
    if (!dayRow) continue;

    const exRows = day.exercises.map((ex, ei) => ({
      training_plan_day_id: dayRow.id,
      name: ex.name,
      sets: ex.sets || 3,
      target_reps: ex.reps || '10-12',
      sort_order: ei,
      muscle_group: ex.muscle || '',
    }));
    if (exRows.length) await supabase.from('training_plan_exercises').insert(exRows);
  }
  console.log(`OK Training: "${name}" (${days.length} days)`);
}

// 1. Push / Pull / Legs
await createTrainingTemplate('Push / Pull / Legs', [
  {
    name: 'Push',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '6-8', muscle: 'Chest' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', muscle: 'Chest' },
      { name: 'Overhead Press', sets: 3, reps: '8-10', muscle: 'Shoulders' },
      { name: 'Lateral Raises', sets: 3, reps: '12-15', muscle: 'Shoulders' },
      { name: 'Tricep Pushdowns', sets: 3, reps: '10-12', muscle: 'Triceps' },
      { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', muscle: 'Triceps' },
    ],
  },
  {
    name: 'Pull',
    exercises: [
      { name: 'Barbell Rows', sets: 4, reps: '6-8', muscle: 'Back' },
      { name: 'Lat Pulldown', sets: 3, reps: '8-10', muscle: 'Back' },
      { name: 'Seated Cable Row', sets: 3, reps: '10-12', muscle: 'Back' },
      { name: 'Face Pulls', sets: 3, reps: '15-20', muscle: 'Rear Delts' },
      { name: 'Barbell Curls', sets: 3, reps: '10-12', muscle: 'Biceps' },
      { name: 'Hammer Curls', sets: 3, reps: '10-12', muscle: 'Biceps' },
    ],
  },
  {
    name: 'Legs',
    exercises: [
      { name: 'Barbell Squat', sets: 4, reps: '6-8', muscle: 'Quads' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10', muscle: 'Hamstrings' },
      { name: 'Leg Press', sets: 3, reps: '10-12', muscle: 'Quads' },
      { name: 'Leg Curl', sets: 3, reps: '10-12', muscle: 'Hamstrings' },
      { name: 'Calf Raises', sets: 4, reps: '12-15', muscle: 'Calves' },
      { name: 'Leg Extensions', sets: 3, reps: '12-15', muscle: 'Quads' },
    ],
  },
]);

// 2. Upper / Lower
await createTrainingTemplate('Upper / Lower', [
  {
    name: 'Upper',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '6-8', muscle: 'Chest' },
      { name: 'Barbell Rows', sets: 4, reps: '6-8', muscle: 'Back' },
      { name: 'Overhead Press', sets: 3, reps: '8-10', muscle: 'Shoulders' },
      { name: 'Lat Pulldown', sets: 3, reps: '8-10', muscle: 'Back' },
      { name: 'Lateral Raises', sets: 3, reps: '12-15', muscle: 'Shoulders' },
      { name: 'Barbell Curls', sets: 3, reps: '10-12', muscle: 'Biceps' },
      { name: 'Tricep Pushdowns', sets: 3, reps: '10-12', muscle: 'Triceps' },
    ],
  },
  {
    name: 'Lower',
    exercises: [
      { name: 'Barbell Squat', sets: 4, reps: '6-8', muscle: 'Quads' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10', muscle: 'Hamstrings' },
      { name: 'Leg Press', sets: 3, reps: '10-12', muscle: 'Quads' },
      { name: 'Leg Curl', sets: 3, reps: '10-12', muscle: 'Hamstrings' },
      { name: 'Bulgarian Split Squats', sets: 3, reps: '10-12', muscle: 'Quads' },
      { name: 'Calf Raises', sets: 4, reps: '12-15', muscle: 'Calves' },
    ],
  },
]);

// 3. Upper A / Lower A / Upper B / Lower B
await createTrainingTemplate('Upper A / Lower A / Upper B / Lower B', [
  {
    name: 'Upper A (Strength)',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '4-6', muscle: 'Chest' },
      { name: 'Barbell Rows', sets: 4, reps: '4-6', muscle: 'Back' },
      { name: 'Overhead Press', sets: 3, reps: '6-8', muscle: 'Shoulders' },
      { name: 'Weighted Pull-Ups', sets: 3, reps: '6-8', muscle: 'Back' },
      { name: 'Barbell Curls', sets: 3, reps: '8-10', muscle: 'Biceps' },
      { name: 'Close-Grip Bench Press', sets: 3, reps: '8-10', muscle: 'Triceps' },
    ],
  },
  {
    name: 'Lower A (Strength)',
    exercises: [
      { name: 'Barbell Squat', sets: 4, reps: '4-6', muscle: 'Quads' },
      { name: 'Romanian Deadlift', sets: 4, reps: '6-8', muscle: 'Hamstrings' },
      { name: 'Leg Press', sets: 3, reps: '8-10', muscle: 'Quads' },
      { name: 'Leg Curl', sets: 3, reps: '8-10', muscle: 'Hamstrings' },
      { name: 'Calf Raises', sets: 4, reps: '10-12', muscle: 'Calves' },
      { name: 'Ab Wheel Rollout', sets: 3, reps: '10-12', muscle: 'Core' },
    ],
  },
  {
    name: 'Upper B (Hypertrophy)',
    exercises: [
      { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', muscle: 'Chest' },
      { name: 'Cable Rows', sets: 4, reps: '10-12', muscle: 'Back' },
      { name: 'Dumbbell Lateral Raises', sets: 4, reps: '12-15', muscle: 'Shoulders' },
      { name: 'Lat Pulldown', sets: 3, reps: '10-12', muscle: 'Back' },
      { name: 'Cable Flyes', sets: 3, reps: '12-15', muscle: 'Chest' },
      { name: 'Incline Dumbbell Curls', sets: 3, reps: '10-12', muscle: 'Biceps' },
      { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', muscle: 'Triceps' },
    ],
  },
  {
    name: 'Lower B (Hypertrophy)',
    exercises: [
      { name: 'Front Squat', sets: 3, reps: '8-10', muscle: 'Quads' },
      { name: 'Stiff-Leg Deadlift', sets: 3, reps: '10-12', muscle: 'Hamstrings' },
      { name: 'Bulgarian Split Squats', sets: 3, reps: '10-12', muscle: 'Quads' },
      { name: 'Leg Extensions', sets: 3, reps: '12-15', muscle: 'Quads' },
      { name: 'Seated Leg Curl', sets: 3, reps: '12-15', muscle: 'Hamstrings' },
      { name: 'Seated Calf Raises', sets: 4, reps: '12-15', muscle: 'Calves' },
      { name: 'Hanging Leg Raises', sets: 3, reps: '12-15', muscle: 'Core' },
    ],
  },
]);


// ═══════════════════════════════════════════
// NUTRITION TEMPLATES (client_id = null)
// ═══════════════════════════════════════════

function food(fname, grams, per100) {
  const factor = grams / 100;
  return {
    fname, grams,
    kcal: Math.round(per100.kcal * factor),
    p: Math.round(per100.p * factor * 10) / 10,
    c: Math.round(per100.c * factor * 10) / 10,
    f: Math.round(per100.f * factor * 10) / 10,
    per100,
  };
}

// 2000 kcal Meal Plan (5 meals)
const meals2000 = [
  {
    name: 'Breakfast', time: '07:30',
    foods: [
      food('Oats', 60, { kcal: 372, p: 13.2, c: 59.5, f: 6.5 }),
      food('Whey Protein', 30, { kcal: 400, p: 80, c: 8, f: 4 }),
      food('Banana', 100, { kcal: 89, p: 1.1, c: 23, f: 0.3 }),
      food('Almond Milk', 200, { kcal: 15, p: 0.6, c: 0.3, f: 1.1 }),
    ],
  },
  {
    name: 'Snack 1', time: '10:00',
    foods: [
      food('Greek Yoghurt 0%', 200, { kcal: 54, p: 10, c: 3.6, f: 0.2 }),
      food('Blueberries', 80, { kcal: 57, p: 0.7, c: 14.5, f: 0.3 }),
      food('Rice Cakes', 30, { kcal: 387, p: 8, c: 81, f: 2.8 }),
    ],
  },
  {
    name: 'Lunch', time: '12:30',
    foods: [
      food('Chicken Breast', 150, { kcal: 165, p: 31, c: 0, f: 3.6 }),
      food('White Rice (cooked)', 180, { kcal: 130, p: 2.7, c: 28, f: 0.3 }),
      food('Broccoli', 120, { kcal: 34, p: 2.8, c: 7, f: 0.4 }),
      food('Olive Oil', 8, { kcal: 884, p: 0, c: 0, f: 100 }),
    ],
  },
  {
    name: 'Snack 2', time: '15:30',
    foods: [
      food('Whey Protein', 30, { kcal: 400, p: 80, c: 8, f: 4 }),
      food('Apple', 150, { kcal: 52, p: 0.3, c: 14, f: 0.2 }),
      food('Almonds', 15, { kcal: 579, p: 21, c: 22, f: 50 }),
    ],
  },
  {
    name: 'Dinner', time: '19:00',
    foods: [
      food('Salmon Fillet', 130, { kcal: 208, p: 20, c: 0, f: 13 }),
      food('Sweet Potato', 200, { kcal: 86, p: 1.6, c: 20, f: 0.1 }),
      food('Mixed Salad', 100, { kcal: 17, p: 1.3, c: 3.3, f: 0.2 }),
      food('Olive Oil', 8, { kcal: 884, p: 0, c: 0, f: 100 }),
    ],
  },
];

const { error: e1 } = await supabase.from('meal_plans').insert({
  client_id: null, coach_id: coachId,
  name: '2000 kcal - Cutting (5 meals)', is_active: true, meals: meals2000,
});
console.log(e1 ? `ERR Nutrition 2000: ${e1.message}` : 'OK Nutrition: "2000 kcal - Cutting (5 meals)"');

// 2500 kcal Meal Plan (5 meals)
const meals2500 = [
  {
    name: 'Breakfast', time: '07:30',
    foods: [
      food('Oats', 80, { kcal: 372, p: 13.2, c: 59.5, f: 6.5 }),
      food('Whey Protein', 30, { kcal: 400, p: 80, c: 8, f: 4 }),
      food('Banana', 120, { kcal: 89, p: 1.1, c: 23, f: 0.3 }),
      food('Peanut Butter', 15, { kcal: 588, p: 25, c: 20, f: 50 }),
      food('Almond Milk', 250, { kcal: 15, p: 0.6, c: 0.3, f: 1.1 }),
    ],
  },
  {
    name: 'Snack 1', time: '10:00',
    foods: [
      food('Greek Yoghurt 0%', 250, { kcal: 54, p: 10, c: 3.6, f: 0.2 }),
      food('Granola', 40, { kcal: 450, p: 10, c: 62, f: 17 }),
      food('Strawberries', 100, { kcal: 32, p: 0.7, c: 7.7, f: 0.3 }),
    ],
  },
  {
    name: 'Lunch', time: '12:30',
    foods: [
      food('Chicken Breast', 180, { kcal: 165, p: 31, c: 0, f: 3.6 }),
      food('White Rice (cooked)', 250, { kcal: 130, p: 2.7, c: 28, f: 0.3 }),
      food('Broccoli', 120, { kcal: 34, p: 2.8, c: 7, f: 0.4 }),
      food('Olive Oil', 10, { kcal: 884, p: 0, c: 0, f: 100 }),
    ],
  },
  {
    name: 'Snack 2', time: '15:30',
    foods: [
      food('Whole Wheat Bread', 80, { kcal: 247, p: 12.5, c: 41, f: 3.4 }),
      food('Turkey Breast Deli', 60, { kcal: 104, p: 18, c: 4.2, f: 1.6 }),
      food('Avocado', 50, { kcal: 160, p: 2, c: 9, f: 15 }),
    ],
  },
  {
    name: 'Dinner', time: '19:00',
    foods: [
      food('Lean Beef Mince (5%)', 170, { kcal: 137, p: 21, c: 0, f: 5.5 }),
      food('Whole Wheat Pasta (cooked)', 220, { kcal: 131, p: 5.3, c: 26, f: 1.1 }),
      food('Tomato Sauce', 100, { kcal: 29, p: 1.3, c: 5.7, f: 0.2 }),
      food('Parmesan', 15, { kcal: 420, p: 35, c: 4, f: 29 }),
      food('Mixed Salad', 100, { kcal: 17, p: 1.3, c: 3.3, f: 0.2 }),
    ],
  },
];

const { error: e2 } = await supabase.from('meal_plans').insert({
  client_id: null, coach_id: coachId,
  name: '2500 kcal - Lean Bulk (5 meals)', is_active: true, meals: meals2500,
});
console.log(e2 ? `ERR Nutrition 2500: ${e2.message}` : 'OK Nutrition: "2500 kcal - Lean Bulk (5 meals)"');

console.log('\nAll templates seeded!');
