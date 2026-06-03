import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '../auth/AuthContext';
import { AppRoutes } from './router';
import './styles.css';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
