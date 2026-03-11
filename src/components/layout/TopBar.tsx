import { Bell, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAlerts } from '@/hooks/use-supabase';
import DocsDrawer from './DocsDrawer';

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export default function TopBar({ onToggleSidebar, sidebarCollapsed }: TopBarProps) {
  const { user, signOut } = useAuth();
  const { data: alerts = [] } = useAlerts();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U';
  const unreadCount = alerts.filter((a) => !a.is_dismissed).length;

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="text-muted-foreground hover:text-foreground transition-colors lg:hidden">
          <Menu className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <DocsDrawer />
        <Button variant="ghost" size="icon" className="relative text-muted-foreground h-8 w-8">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          )}
        </Button>

        <div className="flex items-center gap-1.5 ml-1">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-accent text-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}