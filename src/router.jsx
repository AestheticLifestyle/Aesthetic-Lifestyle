import { createBrowserRouter, Navigate } from 'react-router-dom';
import Shell from './components/layout/Shell';
import AuthGuard from './components/layout/AuthGuard';
import LoginScreen from './screens/auth/LoginScreen';

// Client screens
import DashboardScreen from './screens/client/DashboardScreen';
import TrainingScreen from './screens/client/TrainingScreen';
import NutritionScreen from './screens/client/NutritionScreen';
import ProgressScreen from './screens/client/ProgressScreen';
import JournalScreen from './screens/client/JournalScreen';
import ChatScreen from './screens/client/ChatScreen';
import SettingsScreen from './screens/client/SettingsScreen';
import SupplementsScreen from './screens/client/SupplementsScreen';
import OnboardingScreen from './screens/client/OnboardingScreen';

// Coach screens
import OverviewScreen from './screens/coach/OverviewScreen';
import ClientsScreen from './screens/coach/ClientsScreen';
import CheckinsScreen from './screens/coach/CheckinsScreen';
import WorkoutBuilderScreen from './screens/coach/WorkoutBuilderScreen';
import NutritionEditorScreen from './screens/coach/NutritionEditorScreen';
import CoachChatScreen from './screens/coach/CoachChatScreen';
import ClientProfileScreen from './screens/coach/ClientProfileScreen';
import CoachSettingsScreen from './screens/coach/CoachSettingsScreen';
import CoachSupplementsScreen from './screens/coach/SupplementsScreen';
import WeeklyReviewScreen from './screens/coach/WeeklyReviewScreen';
import AnalyticsScreen from './screens/coach/AnalyticsScreen';

const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginScreen /> },

  // Client routes
  {
    path: '/app',
    element: (
      <AuthGuard requiredRole="client">
        <Shell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardScreen /> },
      { path: 'onboarding', element: <OnboardingScreen /> },
      { path: 'training', element: <TrainingScreen /> },
      { path: 'nutrition', element: <NutritionScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'supplements', element: <SupplementsScreen /> },
      { path: 'journal', element: <JournalScreen /> },
      { path: 'chat', element: <ChatScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },

  // Coach routes
  {
    path: '/coach',
    element: (
      <AuthGuard requiredRole="coach">
        <Shell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <OverviewScreen /> },
      { path: 'clients', element: <ClientsScreen /> },
      { path: 'clients/:clientId', element: <ClientProfileScreen /> },
      { path: 'checkins', element: <CheckinsScreen /> },
      { path: 'weekly-review', element: <WeeklyReviewScreen /> },
      { path: 'analytics', element: <AnalyticsScreen /> },
      { path: 'workout-builder', element: <WorkoutBuilderScreen /> },
      { path: 'nutrition-editor', element: <NutritionEditorScreen /> },
      { path: 'supplements', element: <CoachSupplementsScreen /> },
      { path: 'chat', element: <CoachChatScreen /> },
      { path: 'settings', element: <CoachSettingsScreen /> },
    ],
  },

  // Catch-all → login
  { path: '*', element: <Navigate to="/login" replace /> },
]);

export default router;
