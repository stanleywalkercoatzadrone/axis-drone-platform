
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Global Styles
import App from './App';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { GlobalProvider } from './src/context/GlobalContext';
import './src/i18n'; // initialise i18next

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
