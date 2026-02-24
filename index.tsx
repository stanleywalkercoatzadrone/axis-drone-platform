
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Global Styles
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import { GlobalProvider } from './src/context/GlobalContext';

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
