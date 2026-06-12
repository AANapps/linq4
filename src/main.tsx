import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import LandingPage from './landing/LandingPage.tsx';
import PortalApp from './portal/PortalApp.tsx';
import './index.css';

function Root() {
  // Mobile app bypasses the web routes and renders the consumer experience directly
  if (Capacitor.isNativePlatform()) {
    return <App />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/portal/*" element={<PortalApp />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
