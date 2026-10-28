import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNavigationBar } from './BottomNavigationBar';
import { DesktopTitlebar } from './DesktopTitlebar';
import { SupportModeBanner } from '../admin/SupportModeBanner';

export function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden max-w-full w-full">
      <DesktopTitlebar />
      <SupportModeBanner />
      <div className="flex flex-1 min-h-0 max-w-full overflow-x-hidden">
        {/* Fixed/Sticky Sidebar on Desktop/Tablet */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
          <Header />
          <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8 max-w-7xl w-full mx-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Persistent Bottom Navigation Bar on Mobile Viewports */}
      <BottomNavigationBar />
    </div>
  );
}
