import React, { useState } from 'react';
import SignalTracker from './SignalTracker';
import Settings from './Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('tracker');

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
          className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
        >
          Settings
        </button>
      </div>

      {currentPage === 'tracker' && <SignalTracker />}
      {currentPage === 'settings' && <Settings />}
    </div>
  );
}

export default App;
