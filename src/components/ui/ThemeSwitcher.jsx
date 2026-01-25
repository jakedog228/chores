import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { SunIcon, SunsetIcon, MoonIcon } from '../icons/Icons';

const themeConfig = {
  light: { icon: SunIcon, label: 'Light' },
  dusk: { icon: SunsetIcon, label: 'Dusk' },
  midnight: { icon: MoonIcon, label: 'Midnight' }
};

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const CurrentIcon = themeConfig[theme]?.icon || SunIcon;

  return (
    <div className="theme-switcher" ref={containerRef}>
      <button
        className="theme-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
      >
        <CurrentIcon />
      </button>

      {isOpen && (
        <div className="theme-dropdown">
          {themes.map((t) => {
            const config = themeConfig[t];
            const Icon = config.icon;
            return (
              <button
                key={t}
                className={`theme-option ${t === theme ? 'active' : ''}`}
                onClick={() => {
                  setTheme(t);
                  setIsOpen(false);
                }}
              >
                <Icon />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
