import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { I18nProvider } from './i18n';
import router from './router';

export default function App() {
  const init = useAuthStore(s => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  );
}
