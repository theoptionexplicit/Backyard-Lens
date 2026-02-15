'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '~' },
  { href: '/planner', label: 'Planner', icon: '>' },
  { href: '/health', label: 'Health', icon: '+' },
  { href: '/relationships', label: 'People', icon: '@' },
  { href: '/studio', label: 'Studio', icon: '*' },
  { href: '/automation', label: 'Auto', icon: '#' },
  { href: '/settings', label: 'Settings', icon: '=' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col w-56 border-r border-border bg-surface h-screen sticky top-0">
        <div className="p-5 border-b border-border">
          <h1 className="text-lg font-semibold tracking-tight">MikeOS</h1>
          <p className="text-xs text-muted mt-0.5">your life, your rules</p>
        </div>
        <div className="flex-1 py-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-light text-accent border-r-2 border-accent'
                    : 'text-muted hover:text-foreground hover:bg-accent-light/50'
                }`}
              >
                <span className="font-mono text-xs w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted">local-first / private</p>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface flex justify-around py-2 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                isActive ? 'text-accent' : 'text-muted'
              }`}
            >
              <span className="font-mono text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
