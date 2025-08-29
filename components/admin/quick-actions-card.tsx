"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Database, 
  Download, 
  Settings, 
  Shield, 
  Trash2,
  Play,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuickActionsCardProps {
  onAction?: () => void;
}

export function QuickActionsCard({ onAction }: QuickActionsCardProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [action]: isLoading }));
  };

  const handleDataCollection = async () => {
    setActionLoading('data-collection', true);
    try {
      const response = await adminAPI.triggerDataCollection();
      if (response.success) {
        toast({
          title: "Success",
          description: "Data collection triggered successfully.",
        });
        onAction?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger data collection.",
        variant: "destructive"
      });
    } finally {
      setActionLoading('data-collection', false);
    }
  };

  const handleDatabaseOptimization = async () => {
    setActionLoading('db-optimize', true);
    try {
      const response = await adminAPI.optimizeDatabase();
      if (response.success) {
        toast({
          title: "Success",
          description: "Database optimization completed successfully.",
        });
        onAction?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to optimize database.",
        variant: "destructive"
      });
    } finally {
      setActionLoading('db-optimize', false);
    }
  };

  const handleClearCache = async () => {
    setActionLoading('clear-cache', true);
    try {
      const response = await adminAPI.clearCache();
      if (response.success) {
        toast({
          title: "Success",
          description: "System cache cleared successfully.",
        });
        onAction?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear cache.",
        variant: "destructive"
      });
    } finally {
      setActionLoading('clear-cache', false);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading('backup', true);
    try {
      const response = await adminAPI.createBackup('full');
      if (response.success) {
        toast({
          title: "Success",
          description: "Full system backup initiated successfully.",
        });
        onAction?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create backup.",
        variant: "destructive"
      });
    } finally {
      setActionLoading('backup', false);
    }
  };

  const quickActions = [
    {
      id: 'data-collection',
      label: 'Trigger Data Collection',
      description: 'Manually trigger data collection from all active servers',
      icon: RefreshCw,
      color: 'bg-blue-600/20 text-blue-400 border-blue-400/30',
      hoverColor: 'hover:bg-blue-600/30',
      action: handleDataCollection,
      priority: 'high',
    },
    {
      id: 'db-optimize',
      label: 'Optimize Database',
      description: 'Run database optimization and cleanup routines',
      icon: Database,
      color: 'bg-emerald-600/20 text-emerald-400 border-emerald-400/30',
      hoverColor: 'hover:bg-emerald-600/30',
      action: handleDatabaseOptimization,
      priority: 'medium',
    },
    {
      id: 'clear-cache',
      label: 'Clear Cache',
      description: 'Clear system cache to free up memory',
      icon: Trash2,
      color: 'bg-amber-600/20 text-amber-400 border-amber-400/30',
      hoverColor: 'hover:bg-amber-600/30',
      action: handleClearCache,
      priority: 'medium',
    },
    {
      id: 'backup',
      label: 'Create Backup',
      description: 'Generate a full system backup',
      icon: Download,
      color: 'bg-purple-600/20 text-purple-400 border-purple-400/30',
      hoverColor: 'hover:bg-purple-600/30',
      action: handleCreateBackup,
      priority: 'low',
    },
  ];

  return (
    <div className="space-y-3">
      {quickActions.map((action) => {
        const Icon = action.icon;
        const isLoading = loading[action.id];
        
        return (
          <Card 
            key={action.id}
            className={cn(
              "bg-transparent border transition-all duration-200 cursor-pointer",
              action.color,
              action.hoverColor,
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <CardContent 
              className="p-4 flex items-center justify-between"
              onClick={!isLoading ? action.action : undefined}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Icon className={cn(
                    "h-5 w-5",
                    isLoading && "animate-spin"
                  )} />
                  {action.priority === 'high' && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-sm">{action.label}</h4>
                    {action.priority === 'high' && (
                      <Badge variant="outline" className="text-xs border-red-400/30 text-red-400">
                        Priority
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs opacity-70 mt-1">{action.description}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isLoading ? (
                  <div className="text-xs opacity-70">Running...</div>
                ) : (
                  <Play className="h-4 w-4 opacity-50" />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* System Status Actions */}
      <div className="pt-2 border-t border-[#26262c]">
        <div className="text-xs text-[#ADADB8] mb-2 font-medium">System Actions</div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white text-xs"
          >
            <Settings className="h-3 w-3 mr-1" />
            Config
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white text-xs"
          >
            <Shield className="h-3 w-3 mr-1" />
            Security
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white text-xs"
          >
            <Wrench className="h-3 w-3 mr-1" />
            Tools
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white text-xs"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Alerts
          </Button>
        </div>
      </div>
    </div>
  );
}