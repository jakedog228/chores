import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    needsSetup: false,
    error: null
  });

  const checkAuth = useCallback(async () => {
    try {
      const status = await authApi.getStatus();
      setAuthState({
        loading: false,
        authenticated: status.authenticated,
        needsSetup: status.needsSetup,
        error: null
      });
    } catch (err) {
      setAuthState({
        loading: false,
        authenticated: false,
        needsSetup: false,
        error: err.message
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setAuthState(prev => ({
        ...prev,
        authenticated: false,
        loading: false
      }));
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [checkAuth]);

  const login = useCallback(async (password) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authApi.login(password);
      setAuthState({
        loading: false,
        authenticated: true,
        needsSetup: false,
        error: null
      });
      return { success: true };
    } catch (err) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: err.message
      }));
      return { success: false, error: err.message };
    }
  }, []);

  const setup = useCallback(async (password) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authApi.setup(password);
      setAuthState({
        loading: false,
        authenticated: true,
        needsSetup: false,
        error: null
      });
      return { success: true };
    } catch (err) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: err.message
      }));
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    }
    setAuthState({
      loading: false,
      authenticated: false,
      needsSetup: false,
      error: null
    });
  }, []);

  const value = {
    ...authState,
    login,
    setup,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
