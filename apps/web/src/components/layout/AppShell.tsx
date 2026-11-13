import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNavigationBar } from './BottomNavigationBar';
import { DesktopTitlebar } from './DesktopTitlebar';
import { SupportModeBanner } from '../admin/SupportModeBanner';
import { CommandPaletteModal } from './CommandPaletteModal';

export function AppShell() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden max-w-full w-full">
      <DesktopTitlebar />
      <SupportModeBanner />
      <div className="flex flex-1 min-h-0 max-w-full overflow-hidden">
        {/* Fixed/Sticky Sidebar on Desktop/Tablet */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 max-w-full overflow-hidden">
          <Header onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto overflow-y-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Persistent Bottom Navigation Bar on Mobile Viewports */}
      <BottomNavigationBar />

      {/* Desktop Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
