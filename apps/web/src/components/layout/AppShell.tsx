import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SupportModeBanner } from '../admin/SupportModeBanner';

export function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <SupportModeBanner />
      <div className="flex flex-1 min-h-0">
        {/* Fixed/Sticky Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
