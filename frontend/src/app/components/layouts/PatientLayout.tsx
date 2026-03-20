import React, { useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next'; // Imported i18n hook
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { 
  Activity, 
  Home, 
  Play, 
  BarChart3, 
  MessageSquare, 
  User, 
  LogOut,
  Menu,
  X,
  Globe // Added Globe icon for the language switcher
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PatientLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  key: string;
  path: string;
  icon: React.ElementType;
}

export function PatientLayout({ children }: PatientLayoutProps) {
  // Extract BOTH t and i18n from the hook
  const { t, i18n } = useTranslation(); 
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: t('nav.dashboard', 'Dashboard'), key: 'dashboard', path: '/dashboard', icon: Home },
    { label: t('nav.startWorkout', 'Start Workout'), key: 'startWorkout', path: '/start-workout', icon: Play },
    { label: t('nav.reports', 'Analysis Reports'), key: 'reports', path: '/reports', icon: BarChart3 },
    { label: t('nav.messages', 'Messages'), key: 'messages', path: '/messages', icon: MessageSquare },
    { label: t('nav.profile', 'Profile'), key: 'profile', path: '/profile', icon: User }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-semibold">Physio-Check</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40 top-[65px]"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25 }}
              className="lg:hidden fixed top-[65px] left-0 bottom-0 w-72 bg-white border-r border-border z-50 overflow-y-auto"
            >
              <MobileNav 
                navItems={navItems}
                isActive={isActive}
                navigate={navigate}
                setMobileMenuOpen={setMobileMenuOpen}
                user={user}
                handleLogout={handleLogout}
                logoutText={t('common.logout', 'Logout')}
                i18n={i18n} // Pass i18n down for the mobile switcher
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block fixed top-0 left-0 bottom-0 bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" strokeWidth={2} />
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-semibold text-lg"
                >
                  Physio-Check
                </motion.span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    active
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'hover:bg-sidebar-accent text-sidebar-foreground'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout & Language Switcher */}
          <div className="p-4 border-t border-sidebar-border space-y-2">
            
            {/* --- LANGUAGE SWITCHER ADDED HERE --- */}
            <div className="flex items-center gap-3 px-4 py-2 mb-2">
              <Globe className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
              {sidebarOpen && (
                <select 
                  onChange={(e) => i18n.changeLanguage(e.target.value)} 
                  value={i18n.language}
                  className="w-full bg-transparent border border-sidebar-border rounded-md px-2 py-1 text-sm text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="hin">हिंदी</option>
                  <option value="mar">मराठी</option>
                </select>
              )}
            </div>

            {sidebarOpen && user && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-3 bg-sidebar-accent rounded-xl mb-2"
              >
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="text-xs text-primary mt-1">{user.role === 'physiotherapist' ? t('common.physiotherapistRole', 'Physiotherapist') : t('common.patientRole', 'Patient')}</p>
              </motion.div>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition-all"
              title={!sidebarOpen ? t('common.logout', 'Logout') : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-medium"
                >
                  {t('common.logout', 'Logout')}
                </motion.span>
              )}
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl hover:bg-sidebar-accent transition-all"
            >
              <Menu className="w-5 h-5 text-sidebar-foreground" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`min-h-screen transition-all duration-300 pt-[65px] lg:pt-0 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        }`}
      >
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// Mobile Navigation Component
function MobileNav({ 
  navItems, 
  isActive, 
  navigate, 
  setMobileMenuOpen, 
  user, 
  handleLogout,
  logoutText,
  i18n // Added i18n prop here
}: {
  navItems: NavItem[];
  isActive: (path: string) => boolean;
  navigate: (path: string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  user: any;
  handleLogout: () => void;
  logoutText: string;
  i18n: any;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <p className="text-xs text-primary mt-0.5">{user.role === 'physiotherapist' ? 'Physiotherapist' : 'Patient'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                active
                  ? 'bg-primary text-white'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Language Switcher & Logout (Mobile) */}
      <div className="p-4 border-t border-border space-y-4">
        
        {/* --- MOBILE LANGUAGE SWITCHER --- */}
        <div className="flex items-center gap-3 px-4">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <select 
            onChange={(e) => i18n.changeLanguage(e.target.value)} 
            value={i18n.language}
            className="w-full bg-transparent border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="hin">हिंदी</option>
            <option value="mar">मराठी</option>
          </select>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition-all font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">{logoutText}</span>
        </button>
      </div>
    </div>
  );
}