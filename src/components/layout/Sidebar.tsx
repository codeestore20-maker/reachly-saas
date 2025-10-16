import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  Users,
  MessageSquare,
  Settings,
  CreditCard,
  Sparkles,
  UserPlus,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Send },
  { name: 'Follow Campaigns', href: '/follow-campaigns', icon: UserPlus },
  { name: 'Accounts', href: '/accounts', icon: Users },
  { name: 'Conversations', href: '/conversations', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Plans', href: '/plans', icon: CreditCard },
];

export const Sidebar = () => {
  return (
    <div className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Reachly
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
          <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
            {localStorage.getItem('user_email')?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-foreground">
              {localStorage.getItem('user_name') || 'User'}
            </p>
            <p className="text-xs text-muted-foreground">
              {localStorage.getItem('user_email') || 'user@reachly.com'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
