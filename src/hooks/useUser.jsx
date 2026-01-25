import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

const USER_KEY = 'chores_selected_user';
const UserContext = createContext(null);

export function UserProvider({ children, people }) {
  const [selectedUser, setSelectedUserState] = useState(() => {
    const saved = loadFromStorage(USER_KEY, null);
    if (saved && people.some(p => p.name === saved)) return saved;
    return people[0]?.name || null;
  });

  useEffect(() => {
    if (selectedUser && people.length > 0 && !people.some(p => p.name === selectedUser)) {
      setSelectedUserState(people[0].name);
    }
  }, [people, selectedUser]);

  const setSelectedUser = useCallback((name) => {
    setSelectedUserState(name);
    saveToStorage(USER_KEY, name);
  }, []);

  const value = {
    selectedUser,
    setSelectedUser,
    people
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
