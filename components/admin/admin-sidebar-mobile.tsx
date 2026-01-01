"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Bell,
  Database,
  Settings,
  Flag,
  LogOut,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { AdminLogoutButton } from '@/components/admin-login-supabase';
import { Button } from '@/components/ui/button';

/**
 * Mobile-Optimized Admin Sidebar Navigation
 * 
 * Provides responsive navigation for the admin panel with drawer support on mobile.
 * Automatically collapses to hamburger menu on small screens.
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
    label: 'Server Management',
    href: '/admin/data',
    icon: Database,
    description: 'Manage servers and data collection'
  },
  {
    label: 'Feature Flags',
    href: '/admin/features',
    icon: Flag,
    description: 'Control feature visibility'
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'System configuration'
  }
];

export function AdminSidebarMobile() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header with Menu Toggle - Respects Safe Area */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#1a1a1e] border-b border-[#26262c] px-4 py-3 flex items-center justify-between"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-[#9147ff]/20 border border-[#9147ff]/30">
            <LayoutDashboard className="h-4 w-4 text-[#9147ff]" />
          </div>
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="text-white hover:bg-[#26262c]"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setIsOpen(false)}
          style={{
            top: 'env(safe-area-inset-top)',
          }}
        />
      )}

      {/* Mobile Drawer - Respects Safe Area */}
      <div
        className={cn(
          'md:hidden fixed left-0 bottom-0 z-40 w-64 bg-[#1a1a1e] border-r border-[#26262c] flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          top: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingLeft: 'max(0px, env(safe-area-inset-left))',
          paddingRight: 'max(0px, env(safe-area-inset-right))',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
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
                onClick={handleNavClick}
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

        {/* Logout Button */}
        <div className="p-4 border-t border-[#26262c]">
          <AdminLogoutButton />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-[#1a1a1e] border-r border-[#26262c] flex-col h-screen fixed left-0 top-0">
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

        {/* Logout Button */}
        <div className="p-4 border-t border-[#26262c]">
          <AdminLogoutButton />
        </div>
      </div>
    </>
  );
}

