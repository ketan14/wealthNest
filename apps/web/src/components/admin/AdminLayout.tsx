import { Outlet } from 'react-router-dom';

import { AdminSidebar } from './AdminSidebar';
import { AdminGuard } from './AdminGuard';

export function AdminLayout() {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  );
}
