import React, { useState, useEffect } from 'react';
import SignalTracker from './SignalTracker';
import Settings from './Settings';
import TrackedSignals from './TrackedSignals';
import notificationService from './services/notificationService';

function App() {
  const [currentPage, setCurrentPage] = useState('tracker');

  // Initialize notification service on mount
  useEffect(() => {
    notificationService.init();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>SMC Trading Signals</h1>
        <p>Smart Money Concept Pattern Detection for Binance</p>
      </div>

      <div className="nav">
        <button
          className={`nav-link ${currentPage === 'tracker' ? 'active' : ''}`}
          onClick={() => setCurrentPage('tracker')}
        >
          Signal Tracker
        </button>
        <button
          className={`nav-link ${currentPage === 'tracked' ? 'active' : ''}`}
          onClick={() => setCurrentPage('tracked')}
        >
          Tracked Signals
        </button>
        <button
          className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
        >
          Settings
        </button>
      </div>

      {currentPage === 'tracker' && <SignalTracker />}
      {currentPage === 'tracked' && <TrackedSignals />}
      {currentPage === 'settings' && <Settings />}
    </div>
  );
}

export default App;
