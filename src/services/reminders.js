import { supabase } from './supabase';

// ── Reminder Rules (coach side) ──

export async function fetchReminderRules(clientId) {
  const { data, error } = await supabase
    .from('reminder_rules')
    .select('*')
    .eq('client_id', clientId)
    .single();
  if (error && error.code !== 'PGRST116') console.warn('[fetchReminderRules]', error.message);
  return data || null;
}

export async function saveReminderRules(coachId, clientId, rules) {
  const { data, error } = await supabase
    .from('reminder_rules')
    .upsert({
      coach_id: coachId,
      client_id: clientId,
      ...rules,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'coach_id,client_id' })
    .select('*');
  if (error) {
    console.error('[saveReminderRules]', error);
    return { ok: false };
  }
  return { ok: true, data: data?.[0] };
}

// ── Notifications ──

export async function fetchNotifications(clientId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.warn('[fetchNotifications]', error.message);
  return data || [];
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  return !error;
}

export async function markAllNotificationsRead(clientId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('client_id', clientId)
    .eq('is_read', false);
  return !error;
}

export async function createNotification(clientId, coachId, notification) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      icon: notification.icon || 'bell',
    });
  return !error;
}

// ── Smart Reminder Generator ──
// Called when client opens the app — generates in-app reminders based on activity

export function generateSmartReminders({ dailyCheckin, nutritionLog, weightLog, workoutDone, waterIntake, steps, rules }) {
  const reminders = [];
  const hour = new Date().getHours();

  // Default rules if none set by coach (everything enabled)
  const r = rules || {
    daily_checkin: true,
    weekly_checkin: true,
    meal_logging: true,
    weight_logging: true,
    workout_reminder: true,
    water_intake: true,
    step_target: true,
  };

  // Morning reminders (before noon)
  if (hour < 12) {
    if (r.weight_logging && !weightLog) {
      reminders.push({
        type: 'weight_logging',
        title: 'Morning Weigh-in',
        message: 'Step on the scale before eating. Consistency is key.',
        icon: 'trending-up',
        priority: 'high',
        emoji: '⚖️',
      });
    }
    if (r.workout_reminder && !workoutDone) {
      reminders.push({
        type: 'workout',
        title: 'Workout Today',
        message: 'You have a training session scheduled. Time to move.',
        icon: 'dumbbell',
        priority: 'medium',
        emoji: '💪',
      });
    }
  }

  // Afternoon reminders (noon - 6pm)
  if (hour >= 12 && hour < 18) {
    if (r.meal_logging && !nutritionLog) {
      reminders.push({
        type: 'meal_logging',
        title: 'Log Your Meals',
        message: "You haven't logged any meals today. Track what you eat to stay on plan.",
        icon: 'utensils',
        priority: 'high',
        emoji: '🍽️',
      });
    }
    if (r.water_intake && waterIntake < 1.5) {
      reminders.push({
        type: 'water',
        title: 'Hydration Check',
        message: `You're at ${waterIntake}L so far. Aim for at least 3L today.`,
        icon: 'utensils',
        priority: 'medium',
        emoji: '💧',
      });
    }
  }

  // Evening reminders (after 6pm)
  if (hour >= 18) {
    if (r.daily_checkin && !dailyCheckin) {
      reminders.push({
        type: 'daily_checkin',
        title: 'Daily Check-in',
        message: "Don't forget to submit your daily check-in before bed.",
        icon: 'clipboard',
        priority: 'high',
        emoji: '📋',
      });
    }
    if (r.step_target && steps < 8000) {
      const remaining = 8000 - steps;
      reminders.push({
        type: 'steps',
        title: 'Step Target',
        message: `${remaining.toLocaleString()} steps to go. A short walk can get you there.`,
        icon: 'trending-up',
        priority: 'medium',
        emoji: '🚶',
      });
    }
    if (r.meal_logging && !nutritionLog) {
      reminders.push({
        type: 'meal_logging',
        title: 'Log Your Meals',
        message: "Day's almost over — log your meals so your coach can review them.",
        icon: 'utensils',
        priority: 'high',
        emoji: '🍽️',
      });
    }
  }

  // Weekly check-in (show on Sunday if not done)
  const today = new Date().getDay();
  if (r.weekly_checkin && today === 0) {
    reminders.push({
      type: 'weekly_checkin',
      title: 'Weekly Check-in Due',
      message: 'Submit your weekly check-in so your coach can review your progress.',
      icon: 'clipboard',
      priority: 'high',
      emoji: '📊',
    });
  }

  // All-day: workout not done yet
  if (r.workout_reminder && hour >= 14 && !workoutDone) {
    const existing = reminders.find(r => r.type === 'workout');
    if (!existing) {
      reminders.push({
        type: 'workout',
        title: 'Training Reminder',
        message: "Still time to get your session in today. Don't skip.",
        icon: 'dumbbell',
        priority: 'medium',
        emoji: '🏋️',
      });
    }
  }

  return reminders;
}
