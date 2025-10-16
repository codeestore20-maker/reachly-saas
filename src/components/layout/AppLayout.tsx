import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AuthGuard } from '../AuthGuard';

export const AppLayout = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen w-full bg-background">
        <Sidebar />
        <main className="ml-64 min-h-screen overflow-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  );
};
