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
import { UserProvider, useUser } from './hooks/useUser';
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

function UserSelectionModal({ onDismiss }) {
  const { people, setSelectedUser } = useUser();

  const handleSelect = (userName) => {
    setSelectedUser(userName);
    onDismiss();
  };

  return (
    <div className="modal-overlay">
      <div className="modal user-selection-modal">
        <h2>Who are you?</h2>
        <p className="user-selection-subtitle">Select your name to continue</p>
        <div className="user-selection-list">
          {people.map((person) => (
            <button
              key={person.name}
              className="user-selection-option"
              style={{ '--user-color': person.color }}
              onClick={() => handleSelect(person.name)}
            >
              <span
                className="user-selection-dot"
                style={{ background: person.color }}
              />
              <span>{person.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('home');
  const { logout } = useAuth();
  const { selectedUser } = useUser();
  const [badgeCount, setBadgeCount] = useState(0);
  const [showUserSelection, setShowUserSelection] = useState(() => {
    const savedUser = localStorage.getItem('chores_selected_user');
    return !savedUser;
  });

  useAppBadge(badgeCount);

  // Fetch badge count
  const updateBadgeCount = useCallback(() => {
    if (!selectedUser) return;

    homeApi.get(selectedUser).then(data => {
      setBadgeCount(data.due.length);
    }).catch(() => {});
  }, [selectedUser]);

  // Update badge on mount, user change, and when app regains focus
  useEffect(() => {
    updateBadgeCount();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateBadgeCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('user-changed', updateBadgeCount);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('user-changed', updateBadgeCount);
    };
  }, [updateBadgeCount]);

  return (
    <div className="app">
      <div className="app-header">
        <ThemeSwitcher />
        <UserSwitcher />
        <button className="logout-btn" onClick={logout} title="Sign out">
          Sign out
        </button>
      </div>

      {activeTab === 'home' && <HomePage onRefreshNeeded={updateBadgeCount} />}
      {activeTab === 'calendar' && <CalendarPage />}
      {activeTab === 'trash' && <TrashPage />}

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {showUserSelection && (
        <UserSelectionModal onDismiss={() => setShowUserSelection(false)} />
      )}
    </div>
  );
}

function AuthenticatedApp({ people }) {
  return (
    <UserProvider people={people}>
      <MainApp />
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
