import { useState, useRef, useEffect } from 'react';
import { useUser } from '../../hooks/useUser';
import { UserIcon } from '../icons/Icons';

export function UserSwitcher() {
  const { selectedUser, setSelectedUser, people } = useUser();
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

  const selectedPerson = people.find(p => p.name === selectedUser);

  return (
    <div className="user-switcher" ref={containerRef}>
      <button
        className="user-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title={`Viewing as ${selectedUser}`}
      >
        <UserIcon />
        <span className="user-name">{selectedUser}</span>
        {selectedPerson && (
          <span
            className="user-color-dot"
            style={{ background: selectedPerson.color }}
          />
        )}
      </button>

      {isOpen && (
        <div className="user-dropdown">
          {people.map((person) => (
            <button
              key={person.name}
              className={`user-option ${person.name === selectedUser ? 'active' : ''}`}
              onClick={() => {
                setSelectedUser(person.name);
                setIsOpen(false);
              }}
            >
              <span
                className="user-option-dot"
                style={{ background: person.color }}
              />
              <span>{person.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
