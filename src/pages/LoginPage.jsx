import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ThemeSwitcher } from '../components/ui/ThemeSwitcher';

export function LoginPage() {
  const { needsSetup, login, setup, error: authError, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (needsSetup) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 12) {
        setError('Password must be at least 12 characters');
        return;
      }
      const result = await setup(password);
      if (!result.success) {
        setError(result.error);
      }
    } else {
      const result = await login(password);
      if (!result.success) {
        setError(result.error);
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-theme-switcher">
        <ThemeSwitcher />
      </div>
      <div className="login-container">
        <div className="login-header">
          <h1>{needsSetup ? 'Welcome' : 'Chore Calendar'}</h1>
          <p className="login-subtitle">
            {needsSetup
              ? 'Set up a password to secure the chore calendar'
              : 'Enter the house password to continue'
            }
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">
              {needsSetup ? 'Create Password' : 'Password'}
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={needsSetup ? 'At least 12 characters' : 'Enter the house password'}
                autoFocus
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {needsSetup && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={loading}
              />
            </div>
          )}

          {(error || authError) && (
            <div className="login-error">
              {error || authError}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading || !password}
          >
            {loading ? 'Please wait...' : (needsSetup ? 'Set Up' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}
