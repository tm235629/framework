import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardProvider } from './context/DashboardContext.jsx';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DashboardProvider>
      <App />
    </DashboardProvider>
  </React.StrictMode>
);
