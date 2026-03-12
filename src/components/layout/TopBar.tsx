import { Bell, LogOut, Menu, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAlerts } from '@/hooks/use-supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useLangPrefix } from '@/hooks/use-lang-prefix';
import DocsDrawer from './DocsDrawer';

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export default function TopBar({ onToggleSidebar, sidebarCollapsed }: TopBarProps) {
  const { user, signOut } = useAuth();
  const { data: alerts = [] } = useAlerts();
  const navigate = useNavigate();
  const lp = useLangPrefix();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U';
  const unreadCount = alerts.filter((a) => !a.is_dismissed).length;

  return (
    <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="text-muted-foreground hover:text-foreground transition-colors lg:hidden">
          <Menu className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <DocsDrawer />
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground h-8 w-8"
          onClick={() => navigate(`${lp}/alerts`)}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors ml-1">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(`${lp}/settings`)}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
