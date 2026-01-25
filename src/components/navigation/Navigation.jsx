import { HomeIcon, CalendarIcon, TrashIcon } from '../icons/Icons';

export function Navigation({ activeTab, setActiveTab }) {
  return (
    <nav className="nav">
      <button
        className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => setActiveTab('home')}
      >
        <HomeIcon />
        <span>Home</span>
      </button>
      <button
        className={`nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
        onClick={() => setActiveTab('calendar')}
      >
        <CalendarIcon />
        <span>Calendar</span>
      </button>
      <button
        className={`nav-btn ${activeTab === 'trash' ? 'active' : ''}`}
        onClick={() => setActiveTab('trash')}
      >
        <TrashIcon />
        <span>Trash</span>
      </button>
    </nav>
  );
}
