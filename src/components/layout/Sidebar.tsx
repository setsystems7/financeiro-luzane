import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ArrowLeftRight,
  Wallet,
  Tag,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  PackagePlus,
  Repeat2,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import logoLuzane from '@/assets/logo-luzane.png';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const menuItems = [
  { icon: ShoppingCart, label: 'PDV', path: '/' },
  { icon: Wallet, label: 'Financeiro', path: '/financeiro' },
  { icon: FileText, label: 'Fiado', path: '/fiado' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Produtos', path: '/produtos' },
  { icon: ArrowLeftRight, label: 'Estoque', path: '/estoque' },
  { icon: PackagePlus, label: 'Reposição', path: '/reposicao' },
  { icon: Repeat2, label: 'Trocas', path: '/trocas' },
  { icon: Tag, label: 'Etiquetas', path: '/etiquetas' },
  { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

function SidebarContent({
  collapsed,
  onCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso!');
    navigate('/auth');
  };

  return (
    <>
      {/* Logo */}
      <div
        className={cn(
          'border-b border-sidebar-border flex items-center transition-all duration-300',
          collapsed ? 'p-3 justify-center' : 'p-4 gap-4'
        )}
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-medium/30 to-pink-light/40 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div
            className={cn(
              'relative rounded-xl bg-card shadow-md flex items-center justify-center overflow-hidden border border-pink-light/30 transition-all duration-300',
              collapsed ? 'w-10 h-10' : 'w-12 h-12'
            )}
          >
            <img
              src={logoLuzane}
              alt="Luzane"
              className={cn(
                'object-contain transition-all duration-300',
                collapsed ? 'w-8 h-8' : 'w-10 h-10'
              )}
            />
          </div>
        </div>

        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <h1 className="font-bold text-lg text-sidebar-foreground truncate">Luzane</h1>
            <p className="text-xs text-primary font-medium">Moda Fitness</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-sidebar-accent hover:translate-x-1',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-sidebar-foreground hover:text-sidebar-accent-foreground'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-transform duration-200',
                  'group-hover:scale-110'
                )}
              />
              {!collapsed && <span className="font-medium text-sm animate-fade-in">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn('w-full', collapsed ? 'justify-center' : 'justify-start')}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
        {onCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapse}
            className="w-full justify-center"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="ml-2">Recolher</span>
              </>
            )}
          </Button>
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-card shadow-md">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar">
            <div className="h-full flex flex-col">
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex h-screen bg-sidebar border-r border-sidebar-border flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
      </aside>
    </>
  );
}

