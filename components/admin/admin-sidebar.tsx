"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  LayoutDashboard,
  Server,
  Database,
  Users,
  Bell,
  BarChart3,
  Settings,
  Shield,
  FileText,
  HardDrive,
  Flag,
  AlertTriangle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity,
  Wrench
} from 'lucide-react';
import { useAdminAuth } from '@/lib/admin-auth';
import { AdminMenuItem } from '@/lib/admin-types';
import { cn } from '@/lib/utils';

const adminMenuItems: AdminMenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    href: '/admin',
    permissions: [],
  },
  {
    id: 'servers',
    label: 'Server Management',
    icon: 'Server',
    href: '/admin/servers',
    permissions: ['servers:view'],
  },
  {
    id: 'data',
    label: 'Data Management',
    icon: 'Database',
    href: '/admin/data',
    permissions: ['data:view'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'BarChart3',
    href: '/admin/analytics',
    permissions: ['analytics:view'],
  },
  {
    id: 'banners',
    label: 'Notifications',
    icon: 'Bell',
    href: '/admin/notifications',
    permissions: ['banners:view'],
  },
  {
    id: 'users',
    label: 'User Management',
    icon: 'Users',
    href: '/admin/users',
    permissions: ['users:view'],
  },
  {
    id: 'system',
    label: 'System Config',
    icon: 'Settings',
    href: '/admin/system',
    permissions: ['system:config'],
  },
  {
    id: 'security',
    label: 'Security & Audit',
    icon: 'Shield',
    href: '/admin/security',
    permissions: ['audit:view'],
  },
  {
    id: 'features',
    label: 'Feature Flags',
    icon: 'Flag',
    href: '/admin/features',
    permissions: ['system:manage'],
  },
  {
    id: 'database',
    label: 'Database Tools',
    icon: 'HardDrive',
    href: '/admin/database',
    permissions: ['system:manage'],
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: 'FileText',
    href: '/admin/backups',
    permissions: ['system:backup'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: 'Wrench',
    href: '/admin/maintenance',
    permissions: ['system:manage'],
  },
];

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Server,
  Database,
  Users,
  Bell,
  BarChart3,
  Settings,
  Shield,
  FileText,
  HardDrive,
  Flag,
  AlertTriangle,
  Activity,
  Wrench,
};

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(0);
  const pathname = usePathname();
  const { logout } = useAdminAuth();

  useEffect(() => {
    // TODO: Fetch system alerts count
    setSystemAlerts(3); // Mock data
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/admin/banners'; // Redirect to login
  };

  const isActiveItem = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className={cn(
      "bg-[#1a1a1e] border-r border-[#26262c] flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-[#26262c]">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="text-lg font-semibold text-white">Admin Portal</h2>
              <p className="text-xs text-[#ADADB8]">System Management</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#ADADB8] hover:text-white hover:bg-[#26262c]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">
          {adminMenuItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = isActiveItem(item.href);
            
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200",
                  "hover:bg-[#26262c] hover:text-white",
                  isActive
                    ? "bg-[#9147ff] text-white shadow-lg"
                    : "text-[#ADADB8]",
                  collapsed && "justify-center"
                )}
              >
                <Icon className={cn("h-4 w-4", !collapsed && "mr-3")} />
                
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    
                    {/* Show alerts badge for security */}
                    {item.id === 'security' && systemAlerts > 0 && (
                      <Badge variant="destructive" className="ml-2 px-1 py-0 text-xs">
                        {systemAlerts}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* System Status */}
      {!collapsed && (
        <div className="p-4 border-t border-[#26262c]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#ADADB8]">System Status</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400">Online</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#ADADB8]">API Health</span>
              <span className="text-emerald-400">Good</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#ADADB8]">DB Status</span>
              <span className="text-emerald-400">Connected</span>
            </div>
          </div>
        </div>
      )}

      {/* User Actions */}
      <div className="p-4 border-t border-[#26262c]">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-[#ADADB8] mb-2">
              <div className="w-6 h-6 bg-[#9147ff] rounded-full flex items-center justify-center text-xs text-white">
                A
              </div>
              <span>Admin User</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white p-2"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}