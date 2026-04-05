import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso!');
    navigate('/auth');
  };

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between transition-colors duration-300">
      <div className="min-w-0 flex-1 pl-10 lg:pl-0">
        <h1 className="text-base md:text-xl font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] md:text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <NotificationBell />
        <ThemeToggle />
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">{user?.email?.split('@')[0]}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 md:h-9 md:w-9">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
