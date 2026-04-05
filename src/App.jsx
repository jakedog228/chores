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
import { homeApi, peopleApi, choreStatusApi } from './services/api';
import { CreatureScare } from './components/ui/CreatureScare';
import { BearPersistent } from './components/ui/BearPersistent';
import { SantaPersistent } from './components/ui/SantaPersistent';
import { NotificationToggle } from './components/ui/NotificationPrompt';
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

function StatusPanelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function formatStatusDetail(chore) {
  if (chore.status === 'green') {
    if (chore.lastCompleted) {
      const completedDate = new Date(chore.lastCompleted.completedAt);
      const dateStr = completedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let detail = `${chore.lastCompleted.completedBy} completed ${dateStr}`;
      if (chore.currentlyDue) {
        detail += ` · Next: ${chore.currentlyDue.assignedTo}`;
      }
      return detail;
    }
    return 'Up to date';
  }

  if (chore.status === 'yellow') {
    const who = chore.currentlyDue?.assignedTo || '?';
    if (chore.daysOverdue === 0) return `Due today · ${who}'s turn`;
    if (chore.daysOverdue === 1) return `Due yesterday · ${who}'s turn`;
    return `${chore.daysOverdue} days overdue · ${who}'s turn`;
  }

  const who = chore.currentlyDue?.assignedTo || '?';
  return `${chore.daysOverdue} days overdue · ${who}'s turn`;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('home');
  const { logout } = useAuth();
  const { selectedUser } = useUser();
  const [badgeCount, setBadgeCount] = useState(0);
  const [homeData, setHomeData] = useState({ due: [], upcoming: [] });
  const [choreStatuses, setChoreStatuses] = useState([]);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [showUserSelection, setShowUserSelection] = useState(() => {
    const savedUser = localStorage.getItem('chores_selected_user');
    return !savedUser;
  });

  useAppBadge(badgeCount);

  // Fetch badge count and bear data
  const updateBadgeCount = useCallback(() => {
    if (!selectedUser) return;

    homeApi.get(selectedUser).then(data => {
      setBadgeCount(data.due.length);
      setHomeData(data);
    }).catch(() => {});

    choreStatusApi.get().then(setChoreStatuses).catch(() => {});
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
      <CreatureScare dueChores={homeData.due} onScareComplete={updateBadgeCount} />
      <BearPersistent dueChores={homeData.due} />
      <SantaPersistent />
      <div className="app-header">
        <NotificationToggle />
        <ThemeSwitcher />
        <UserSwitcher />
        <button className="logout-btn" onClick={logout} title="Sign out">
          Sign out
        </button>
      </div>

      {choreStatuses.length > 0 && (
        <button
          className="status-panel-toggle"
          onClick={() => setStatusPanelOpen(true)}
          title="Chore status"
        >
          <StatusPanelIcon />
          <span className="status-panel-toggle-label">Status</span>
          {choreStatuses.some(c => c.status === 'red') && (
            <span className="status-panel-badge red" />
          )}
          {!choreStatuses.some(c => c.status === 'red') && choreStatuses.some(c => c.status === 'yellow') && (
            <span className="status-panel-badge yellow" />
          )}
        </button>
      )}

      {statusPanelOpen && (
        <div className="status-panel-overlay" onClick={() => setStatusPanelOpen(false)}>
          <div className="status-panel" onClick={e => e.stopPropagation()}>
            <div className="status-panel-header">
              <h2>Chore Status</h2>
              <button
                className="status-panel-close"
                onClick={() => setStatusPanelOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="status-panel-body">
              {choreStatuses.map(chore => (
                <div
                  key={chore.choreName}
                  className={`chore-status-card status-${chore.status}`}
                >
                  <div className="chore-status-indicator" />
                  <div className="chore-status-content">
                    <span className="chore-status-name">{chore.choreName}</span>
                    <span className="chore-status-detail">
                      {formatStatusDetail(chore)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'home' && <HomePage onRefreshNeeded={updateBadgeCount} />}
      {activeTab === 'calendar' && <CalendarPage onRefreshNeeded={updateBadgeCount} />}
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
