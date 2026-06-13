import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Linq</h1>
      <p className="mt-4 text-gray-500">Loyalty, simplified.</p>
      <a
        href="/portal"
        className="mt-8 px-6 py-3 bg-black text-white rounded-lg text-sm font-medium"
      >
        Vendor Login
      </a>
    </div>
  );
}
