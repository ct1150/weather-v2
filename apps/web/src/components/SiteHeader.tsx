import type { ReactElement } from "react";

function BrandMark(): ReactElement {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <path
          d="M9 22.5h16.2a5.3 5.3 0 0 0 .2-10.6 8.1 8.1 0 0 0-15.2 2.7A4 4 0 0 0 9 22.5Z"
          fill="currentColor"
        />
        <path
          d="m11.5 27.2-1.7 2.5m7.8-2.5-1.7 2.5m7.8-2.5L22 29.7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function SiteHeader(): ReactElement {
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <a
          href="/"
          className="group flex items-center gap-2.5 rounded-lg focus-ring"
          aria-label="Where Not Rain home"
        >
          <BrandMark />
          <span className="text-[15px] font-bold tracking-[-0.02em] text-foreground sm:text-base">
            Where Not Rain
          </span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-1">
          <a href="/" className="nav-link focus-ring">
            Radar
          </a>
          <a href="/explore" className="nav-link focus-ring">
            <span className="hidden sm:inline">Explore map</span>
            <span className="sm:hidden">Explore</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
