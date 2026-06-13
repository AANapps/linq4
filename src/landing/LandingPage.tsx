import React from 'react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Top nav */}
      <nav className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-5">
        <span
          className="text-2xl font-black italic tracking-tight text-white select-none"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Linq
        </span>
        <a
          href="/portal"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-semibold transition-colors border border-white/20"
        >
          Linq Vendors
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
      </nav>

      {/* Hero — blue gradient */}
      <section className="gradient-logo-blue relative overflow-hidden flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 min-h-[85vh]">
        {/* Subtle star dots */}
        {[
          { top: '12%', left: '8%', size: 3, opacity: 0.3 },
          { top: '22%', left: '82%', size: 2, opacity: 0.25 },
          { top: '55%', left: '5%', size: 4, opacity: 0.2 },
          { top: '70%', left: '90%', size: 3, opacity: 0.25 },
          { top: '38%', left: '93%', size: 2, opacity: 0.3 },
          { top: '80%', left: '15%', size: 2, opacity: 0.2 },
        ].map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white pointer-events-none"
            style={{ top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.opacity }}
          />
        ))}

        <h1
          className="text-7xl sm:text-8xl font-black italic tracking-tight text-white leading-none mb-4 select-none"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Linq
        </h1>
        <p className="text-white/90 text-xl sm:text-2xl font-semibold max-w-sm leading-snug">
          Loyalty cards, reinvented
        </p>
        <p className="mt-3 text-white/65 text-sm sm:text-base max-w-xs leading-relaxed">
          Collect stamps, earn rewards, and support local businesses — all from your phone.
        </p>

        {/* App store badges */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <a
            href="https://apps.apple.com/app/linq-loyalty/id6740977866"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-5 py-3 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="text-left">
              <p className="text-[10px] text-gray-500 leading-none">Download on the</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">App Store</p>
            </div>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.adastranetwork.linq"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-5 py-3 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M3.18 23.76a2.5 2.5 0 01-1.18-2.2V2.44A2.5 2.5 0 013.18.24L13.59 12 3.18 23.76z" fill="#EA4335"/>
              <path d="M17.41 15.83l-3.13-3.13 3.13-3.13 3.54 2.05a1.44 1.44 0 010 2.16l-3.54 2.05z" fill="#FBBC04"/>
              <path d="M3.18 23.76L13.59 12 17.41 15.83 5.3 22.83a2.5 2.5 0 01-2.12.93z" fill="#34A853"/>
              <path d="M3.18.24a2.5 2.5 0 012.12.93L17.41 8.17 13.59 12 3.18.24z" fill="#4285F4"/>
            </svg>
            <div className="text-left">
              <p className="text-[10px] text-gray-500 leading-none">Get it on</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">Google Play</p>
            </div>
          </a>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">How it works</h2>
        <p className="text-center text-gray-500 text-sm mb-10">No paper. No fuss. Just tap and collect.</p>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              ),
              title: 'Collect stamps',
              desc: 'Visit your favourite local spots and earn digital stamps with every purchase.',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              ),
              title: 'Earn rewards',
              desc: 'Fill your card and unlock free drinks, discounts, and exclusive offers.',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              ),
              title: 'Discover locally',
              desc: 'Find businesses near you running loyalty programmes and never miss a reward.',
            },
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl gradient-logo-blue flex items-center justify-center text-white shadow-md">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{f.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="gradient-logo-blue mx-4 sm:mx-auto sm:max-w-2xl rounded-3xl px-8 py-10 text-center mb-16 shadow-xl">
        <p
          className="text-3xl font-black italic tracking-tight text-white mb-2 select-none"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Ready to start?
        </p>
        <p className="text-white/70 text-sm mb-6">Download Linq and join thousands of happy customers.</p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a
            href="https://apps.apple.com/app/linq-loyalty/id6740977866"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-white rounded-xl text-sm font-bold text-gray-900 shadow hover:shadow-md transition-shadow"
          >
            App Store
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.adastranetwork.linq"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-white/15 border border-white/25 rounded-xl text-sm font-bold text-white hover:bg-white/25 transition-colors"
          >
            Google Play
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-100 px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
        <span
          className="font-black italic text-gray-300 select-none"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Linq
        </span>
        <span>© {new Date().getFullYear()} Ad Astra Network. All rights reserved.</span>
        <div className="flex gap-4">
          <a href="/privacy.html" className="hover:text-gray-600 transition-colors">Privacy</a>
          <a href="/portal" className="hover:text-gray-600 transition-colors">Vendor Login</a>
        </div>
      </footer>

    </div>
  );
}
