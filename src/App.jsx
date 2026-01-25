import { useState, useEffect, useCallback } from 'react';
import { Navigation } from './components/navigation/Navigation';
import { ThemeSwitcher } from './components/ui/ThemeSwitcher';
import { UserSwitcher } from './components/ui/UserSwitcher';
import { HomePage } from './pages/HomePage';
import { CalendarPage } from './pages/CalendarPage';
import { TrashPage } from './pages/TrashPage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { UserProvider } from './hooks/useUser';
import { useAppBadge } from './hooks/useAppBadge';
import { homeApi, peopleApi } from './services/api';
import './App.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  );
}

function AuthenticatedApp({ people }) {
  const [activeTab, setActiveTab] = useState('home');
  const { logout } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useAppBadge(badgeCount);

  const handleRefreshNeeded = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Open user switcher on fresh sign-in (no saved user preference)
  useEffect(() => {
    const savedUser = localStorage.getItem('chores_selected_user');
    if (!savedUser) {
      // Delay slightly to ensure UserSwitcher is mounted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('user-switcher:open'));
      }, 100);
    }
  }, []);

  // Fetch badge count
  useEffect(() => {
    const user = localStorage.getItem('chores_selected_user') ?
      JSON.parse(localStorage.getItem('chores_selected_user')) :
      people[0]?.name;
    if (!user) return;

    homeApi.get(user).then(data => {
      setBadgeCount(data.due.length);
    }).catch(() => {});
  }, [people, refreshKey]);

  return (
    <UserProvider people={people}>
      <div className="app">
        <div className="app-header">
          <ThemeSwitcher />
          <UserSwitcher />
          <button className="logout-btn" onClick={logout} title="Sign out">
            Sign out
          </button>
        </div>

        {activeTab === 'home' && (
          <HomePage key={refreshKey} onRefreshNeeded={handleRefreshNeeded} />
        )}

        {activeTab === 'calendar' && (
          <CalendarPage />
        )}

        {activeTab === 'trash' && (
          <TrashPage />
        )}

        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </UserProvider>
  );
}

function AppContent() {
  const { loading, authenticated, needsSetup } = useAuth();
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  useEffect(() => {
    if (authenticated) {
      peopleApi.getAll().then(data => {
        setPeople(data);
        setPeopleLoading(false);
      }).catch(() => setPeopleLoading(false));
    }
  }, [authenticated]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!authenticated || needsSetup) {
    return <LoginPage />;
  }

  if (peopleLoading) {
    return <LoadingScreen />;
  }

  return <AuthenticatedApp people={people} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
