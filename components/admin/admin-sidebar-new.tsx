"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Bell,
  Database,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { AdminLogoutButton } from '@/components/admin-login-supabase';

/**
 * Admin Sidebar Navigation
 * 
 * Provides navigation for the admin panel with real sections only.
 * Source: PRD §4.1 FR-9; Blueprint §2.3
 */

const ADMIN_MENU_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Overview and live visitor tracking'
  },
  {
    label: 'Visitor Analytics',
    href: '/admin/visitors',
    icon: Users,
    description: 'Detailed visitor tracking and analytics'
  },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
    description: 'Manage notification banners'
  },
  {
    label: 'Data Management',
    href: '/admin/data',
    icon: Database,
    description: 'Data collection and export'
  },
  {
    label: 'System Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    description: 'API and system performance metrics'
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'System configuration'
  }
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-[#1a1a1e] border-r border-[#26262c] flex flex-col h-screen">
      {/* Logo/Header */}
      <div className="p-6 border-b border-[#26262c]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-[#9147ff]/20 border border-[#9147ff]/30">
            <LayoutDashboard className="h-5 w-5 text-[#9147ff]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">Admin Panel</h1>
            <p className="text-[#ADADB8] text-xs">Management Console</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {ADMIN_MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-lg transition-all group',
                isActive
                  ? 'bg-[#9147ff]/20 border border-[#9147ff]/30 text-[#9147ff]'
                  : 'text-[#ADADB8] hover:bg-[#26262c]/50 hover:text-white'
              )}
              title={item.description}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {isActive && (
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer - Logout */}
      <div className="p-4 border-t border-[#26262c] space-y-3">
        <div className="px-4 py-2 bg-[#26262c]/50 rounded-lg">
          <p className="text-xs text-[#ADADB8]">Signed in as admin</p>
        </div>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
