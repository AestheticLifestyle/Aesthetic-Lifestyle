-- ═══════════════════════════════════════════════════════
-- SEED: Training & Nutrition Templates for Coach
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

DO $$
DECLARE
  v_coach_id uuid;
  v_plan_id uuid;
  v_day_id uuid;
BEGIN
  -- Find coach
  SELECT id INTO v_coach_id FROM profiles WHERE role = 'coach' LIMIT 1;
  IF v_coach_id IS NULL THEN RAISE EXCEPTION 'No coach found'; END IF;

  -- ════════════════════════════════════════
  -- 1. PUSH / PULL / LEGS
  -- ════════════════════════════════════════
  INSERT INTO training_plans (client_id, coach_id, name, is_active)
  VALUES (NULL, v_coach_id, 'Push / Pull / Legs', true)
  RETURNING id INTO v_plan_id;

  -- Push Day
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Push', 0, 0) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Bench Press', 4, '6-8', 0),
    (v_day_id, 'Incline Dumbbell Press', 3, '8-10', 1),
    (v_day_id, 'Overhead Press', 3, '8-10', 2),
    (v_day_id, 'Lateral Raises', 3, '12-15', 3),
    (v_day_id, 'Tricep Pushdowns', 3, '10-12', 4),
    (v_day_id, 'Overhead Tricep Extension', 3, '10-12', 5);

  -- Pull Day
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Pull', 1, 1) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Rows', 4, '6-8', 0),
    (v_day_id, 'Lat Pulldown', 3, '8-10', 1),
    (v_day_id, 'Seated Cable Row', 3, '10-12', 2),
    (v_day_id, 'Face Pulls', 3, '15-20', 3),
    (v_day_id, 'Barbell Curls', 3, '10-12', 4),
    (v_day_id, 'Hammer Curls', 3, '10-12', 5);

  -- Legs Day
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Legs', 2, 2) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Squat', 4, '6-8', 0),
    (v_day_id, 'Romanian Deadlift', 3, '8-10', 1),
    (v_day_id, 'Leg Press', 3, '10-12', 2),
    (v_day_id, 'Leg Curl', 3, '10-12', 3),
    (v_day_id, 'Calf Raises', 4, '12-15', 4),
    (v_day_id, 'Leg Extensions', 3, '12-15', 5);


  -- ════════════════════════════════════════
  -- 2. UPPER / LOWER
  -- ════════════════════════════════════════
  INSERT INTO training_plans (client_id, coach_id, name, is_active)
  VALUES (NULL, v_coach_id, 'Upper / Lower', true)
  RETURNING id INTO v_plan_id;

  -- Upper
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Upper', 0, 0) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Bench Press', 4, '6-8', 0),
    (v_day_id, 'Barbell Rows', 4, '6-8', 1),
    (v_day_id, 'Overhead Press', 3, '8-10', 2),
    (v_day_id, 'Lat Pulldown', 3, '8-10', 3),
    (v_day_id, 'Lateral Raises', 3, '12-15', 4),
    (v_day_id, 'Barbell Curls', 3, '10-12', 5),
    (v_day_id, 'Tricep Pushdowns', 3, '10-12', 6);

  -- Lower
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Lower', 1, 1) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Squat', 4, '6-8', 0),
    (v_day_id, 'Romanian Deadlift', 3, '8-10', 1),
    (v_day_id, 'Leg Press', 3, '10-12', 2),
    (v_day_id, 'Leg Curl', 3, '10-12', 3),
    (v_day_id, 'Bulgarian Split Squats', 3, '10-12', 4),
    (v_day_id, 'Calf Raises', 4, '12-15', 5);


  -- ════════════════════════════════════════
  -- 3. UPPER A / LOWER A / UPPER B / LOWER B
  -- ════════════════════════════════════════
  INSERT INTO training_plans (client_id, coach_id, name, is_active)
  VALUES (NULL, v_coach_id, 'Upper A / Lower A / Upper B / Lower B', true)
  RETURNING id INTO v_plan_id;

  -- Upper A (Strength)
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Upper A (Strength)', 0, 0) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Bench Press', 4, '4-6', 0),
    (v_day_id, 'Barbell Rows', 4, '4-6', 1),
    (v_day_id, 'Overhead Press', 3, '6-8', 2),
    (v_day_id, 'Weighted Pull-Ups', 3, '6-8', 3),
    (v_day_id, 'Barbell Curls', 3, '8-10', 4),
    (v_day_id, 'Close-Grip Bench Press', 3, '8-10', 5);

  -- Lower A (Strength)
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Lower A (Strength)', 1, 1) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Barbell Squat', 4, '4-6', 0),
    (v_day_id, 'Romanian Deadlift', 4, '6-8', 1),
    (v_day_id, 'Leg Press', 3, '8-10', 2),
    (v_day_id, 'Leg Curl', 3, '8-10', 3),
    (v_day_id, 'Calf Raises', 4, '10-12', 4),
    (v_day_id, 'Ab Wheel Rollout', 3, '10-12', 5);

  -- Upper B (Hypertrophy)
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Upper B (Hypertrophy)', 2, 2) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Incline Dumbbell Press', 4, '8-12', 0),
    (v_day_id, 'Cable Rows', 4, '10-12', 1),
    (v_day_id, 'Dumbbell Lateral Raises', 4, '12-15', 2),
    (v_day_id, 'Lat Pulldown', 3, '10-12', 3),
    (v_day_id, 'Cable Flyes', 3, '12-15', 4),
    (v_day_id, 'Incline Dumbbell Curls', 3, '10-12', 5),
    (v_day_id, 'Overhead Tricep Extension', 3, '10-12', 6);

  -- Lower B (Hypertrophy)
  INSERT INTO training_plan_days (training_plan_id, name, day_of_week, sort_order)
  VALUES (v_plan_id, 'Lower B (Hypertrophy)', 3, 3) RETURNING id INTO v_day_id;
  INSERT INTO training_plan_exercises (training_plan_day_id, name, sets, target_reps, sort_order) VALUES
    (v_day_id, 'Front Squat', 3, '8-10', 0),
    (v_day_id, 'Stiff-Leg Deadlift', 3, '10-12', 1),
    (v_day_id, 'Bulgarian Split Squats', 3, '10-12', 2),
    (v_day_id, 'Leg Extensions', 3, '12-15', 3),
    (v_day_id, 'Seated Leg Curl', 3, '12-15', 4),
    (v_day_id, 'Seated Calf Raises', 4, '12-15', 5),
    (v_day_id, 'Hanging Leg Raises', 3, '12-15', 6);


  -- ════════════════════════════════════════
  -- 4. NUTRITION: 2000 kcal - Cutting (5 meals)
  -- ════════════════════════════════════════
  INSERT INTO meal_plans (client_id, coach_id, name, is_active, meals) VALUES (
    NULL, v_coach_id, '2000 kcal - Cutting (5 meals)', true,
    '[
      {"name":"Breakfast","time":"07:30","foods":[
        {"fname":"Oats","grams":60,"kcal":223,"p":7.9,"c":35.7,"f":3.9,"per100":{"kcal":372,"p":13.2,"c":59.5,"f":6.5}},
        {"fname":"Whey Protein","grams":30,"kcal":120,"p":24.0,"c":2.4,"f":1.2,"per100":{"kcal":400,"p":80,"c":8,"f":4}},
        {"fname":"Banana","grams":100,"kcal":89,"p":1.1,"c":23.0,"f":0.3,"per100":{"kcal":89,"p":1.1,"c":23,"f":0.3}},
        {"fname":"Almond Milk","grams":200,"kcal":30,"p":1.2,"c":0.6,"f":2.2,"per100":{"kcal":15,"p":0.6,"c":0.3,"f":1.1}}
      ]},
      {"name":"Snack 1","time":"10:00","foods":[
        {"fname":"Greek Yoghurt 0%","grams":200,"kcal":108,"p":20.0,"c":7.2,"f":0.4,"per100":{"kcal":54,"p":10,"c":3.6,"f":0.2}},
        {"fname":"Blueberries","grams":80,"kcal":46,"p":0.6,"c":11.6,"f":0.2,"per100":{"kcal":57,"p":0.7,"c":14.5,"f":0.3}},
        {"fname":"Rice Cakes","grams":30,"kcal":116,"p":2.4,"c":24.3,"f":0.8,"per100":{"kcal":387,"p":8,"c":81,"f":2.8}}
      ]},
      {"name":"Lunch","time":"12:30","foods":[
        {"fname":"Chicken Breast","grams":150,"kcal":248,"p":46.5,"c":0.0,"f":5.4,"per100":{"kcal":165,"p":31,"c":0,"f":3.6}},
        {"fname":"White Rice (cooked)","grams":180,"kcal":234,"p":4.9,"c":50.4,"f":0.5,"per100":{"kcal":130,"p":2.7,"c":28,"f":0.3}},
        {"fname":"Broccoli","grams":120,"kcal":41,"p":3.4,"c":8.4,"f":0.5,"per100":{"kcal":34,"p":2.8,"c":7,"f":0.4}},
        {"fname":"Olive Oil","grams":8,"kcal":71,"p":0.0,"c":0.0,"f":8.0,"per100":{"kcal":884,"p":0,"c":0,"f":100}}
      ]},
      {"name":"Snack 2","time":"15:30","foods":[
        {"fname":"Whey Protein","grams":30,"kcal":120,"p":24.0,"c":2.4,"f":1.2,"per100":{"kcal":400,"p":80,"c":8,"f":4}},
        {"fname":"Apple","grams":150,"kcal":78,"p":0.5,"c":21.0,"f":0.3,"per100":{"kcal":52,"p":0.3,"c":14,"f":0.2}},
        {"fname":"Almonds","grams":15,"kcal":87,"p":3.2,"c":3.3,"f":7.5,"per100":{"kcal":579,"p":21,"c":22,"f":50}}
      ]},
      {"name":"Dinner","time":"19:00","foods":[
        {"fname":"Salmon Fillet","grams":130,"kcal":270,"p":26.0,"c":0.0,"f":16.9,"per100":{"kcal":208,"p":20,"c":0,"f":13}},
        {"fname":"Sweet Potato","grams":200,"kcal":172,"p":3.2,"c":40.0,"f":0.2,"per100":{"kcal":86,"p":1.6,"c":20,"f":0.1}},
        {"fname":"Mixed Salad","grams":100,"kcal":17,"p":1.3,"c":3.3,"f":0.2,"per100":{"kcal":17,"p":1.3,"c":3.3,"f":0.2}},
        {"fname":"Olive Oil","grams":8,"kcal":71,"p":0.0,"c":0.0,"f":8.0,"per100":{"kcal":884,"p":0,"c":0,"f":100}}
      ]}
    ]'::jsonb
  );


  -- ════════════════════════════════════════
  -- 5. NUTRITION: 2500 kcal - Lean Bulk (5 meals)
  -- ════════════════════════════════════════
  INSERT INTO meal_plans (client_id, coach_id, name, is_active, meals) VALUES (
    NULL, v_coach_id, '2500 kcal - Lean Bulk (5 meals)', true,
    '[
      {"name":"Breakfast","time":"07:30","foods":[
        {"fname":"Oats","grams":80,"kcal":298,"p":10.6,"c":47.6,"f":5.2,"per100":{"kcal":372,"p":13.2,"c":59.5,"f":6.5}},
        {"fname":"Whey Protein","grams":30,"kcal":120,"p":24.0,"c":2.4,"f":1.2,"per100":{"kcal":400,"p":80,"c":8,"f":4}},
        {"fname":"Banana","grams":120,"kcal":107,"p":1.3,"c":27.6,"f":0.4,"per100":{"kcal":89,"p":1.1,"c":23,"f":0.3}},
        {"fname":"Peanut Butter","grams":15,"kcal":88,"p":3.8,"c":3.0,"f":7.5,"per100":{"kcal":588,"p":25,"c":20,"f":50}},
        {"fname":"Almond Milk","grams":250,"kcal":38,"p":1.5,"c":0.8,"f":2.8,"per100":{"kcal":15,"p":0.6,"c":0.3,"f":1.1}}
      ]},
      {"name":"Snack 1","time":"10:00","foods":[
        {"fname":"Greek Yoghurt 0%","grams":250,"kcal":135,"p":25.0,"c":9.0,"f":0.5,"per100":{"kcal":54,"p":10,"c":3.6,"f":0.2}},
        {"fname":"Granola","grams":40,"kcal":180,"p":4.0,"c":24.8,"f":6.8,"per100":{"kcal":450,"p":10,"c":62,"f":17}},
        {"fname":"Strawberries","grams":100,"kcal":32,"p":0.7,"c":7.7,"f":0.3,"per100":{"kcal":32,"p":0.7,"c":7.7,"f":0.3}}
      ]},
      {"name":"Lunch","time":"12:30","foods":[
        {"fname":"Chicken Breast","grams":180,"kcal":297,"p":55.8,"c":0.0,"f":6.5,"per100":{"kcal":165,"p":31,"c":0,"f":3.6}},
        {"fname":"White Rice (cooked)","grams":250,"kcal":325,"p":6.8,"c":70.0,"f":0.8,"per100":{"kcal":130,"p":2.7,"c":28,"f":0.3}},
        {"fname":"Broccoli","grams":120,"kcal":41,"p":3.4,"c":8.4,"f":0.5,"per100":{"kcal":34,"p":2.8,"c":7,"f":0.4}},
        {"fname":"Olive Oil","grams":10,"kcal":88,"p":0.0,"c":0.0,"f":10.0,"per100":{"kcal":884,"p":0,"c":0,"f":100}}
      ]},
      {"name":"Snack 2","time":"15:30","foods":[
        {"fname":"Whole Wheat Bread","grams":80,"kcal":198,"p":10.0,"c":32.8,"f":2.7,"per100":{"kcal":247,"p":12.5,"c":41,"f":3.4}},
        {"fname":"Turkey Breast Deli","grams":60,"kcal":62,"p":10.8,"c":2.5,"f":1.0,"per100":{"kcal":104,"p":18,"c":4.2,"f":1.6}},
        {"fname":"Avocado","grams":50,"kcal":80,"p":1.0,"c":4.5,"f":7.5,"per100":{"kcal":160,"p":2,"c":9,"f":15}}
      ]},
      {"name":"Dinner","time":"19:00","foods":[
        {"fname":"Lean Beef Mince (5%)","grams":170,"kcal":233,"p":35.7,"c":0.0,"f":9.4,"per100":{"kcal":137,"p":21,"c":0,"f":5.5}},
        {"fname":"Whole Wheat Pasta (cooked)","grams":220,"kcal":288,"p":11.7,"c":57.2,"f":2.4,"per100":{"kcal":131,"p":5.3,"c":26,"f":1.1}},
        {"fname":"Tomato Sauce","grams":100,"kcal":29,"p":1.3,"c":5.7,"f":0.2,"per100":{"kcal":29,"p":1.3,"c":5.7,"f":0.2}},
        {"fname":"Parmesan","grams":15,"kcal":63,"p":5.3,"c":0.6,"f":4.4,"per100":{"kcal":420,"p":35,"c":4,"f":29}},
        {"fname":"Mixed Salad","grams":100,"kcal":17,"p":1.3,"c":3.3,"f":0.2,"per100":{"kcal":17,"p":1.3,"c":3.3,"f":0.2}}
      ]}
    ]'::jsonb
  );

  RAISE NOTICE 'All templates created successfully!';
END $$;
