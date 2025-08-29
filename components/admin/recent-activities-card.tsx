"use client";

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  Server, 
  Bell, 
  Database, 
  Shield, 
  Settings,
  Activity,
  Clock,
  ExternalLink
} from 'lucide-react';
import { AuditLog } from '@/lib/admin-types';
import { cn } from '@/lib/utils';

interface RecentActivitiesCardProps {
  activities: AuditLog[];
  limit?: number;
}

export function RecentActivitiesCard({ activities, limit = 10 }: RecentActivitiesCardProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayedActivities = showAll ? activities : activities.slice(0, limit);

  const getActivityIcon = (action: string, resourceType: string) => {
    if (action.includes('server')) return Server;
    if (action.includes('banner') || action.includes('notification')) return Bell;
    if (action.includes('user')) return User;
    if (action.includes('data') || action.includes('collection')) return Database;
    if (action.includes('security') || action.includes('login')) return Shield;
    if (action.includes('config') || action.includes('system')) return Settings;
    return Activity;
  };

  const getActivityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-400/10';
      case 'high': return 'text-amber-400 bg-amber-400/10';
      case 'medium': return 'text-blue-400 bg-blue-400/10';
      case 'low': return 'text-emerald-400 bg-emerald-400/10';
      default: return 'text-[#ADADB8] bg-[#26262c]';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-400/30 text-red-400';
      case 'high': return 'border-amber-400/30 text-amber-400';
      case 'medium': return 'border-blue-400/30 text-blue-400';
      case 'low': return 'border-emerald-400/30 text-emerald-400';
      default: return 'border-[#40404a] text-[#ADADB8]';
    }
  };

  const formatActionText = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Activity className="h-8 w-8 text-[#ADADB8] mb-3" />
        <p className="text-[#ADADB8] text-sm">No recent activities</p>
        <p className="text-[#ADADB8] text-xs mt-1">
          System activities will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-3">
          {displayedActivities.map((activity) => {
            const Icon = getActivityIcon(activity.action, activity.resource_type);
            const timeAgo = formatTimeAgo(activity.timestamp);
            
            return (
              <div 
                key={activity.id}
                className="flex items-start space-x-3 p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 hover:bg-[#26262c]/50 transition-colors"
              >
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  getActivityColor(activity.severity)
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">
                        {formatActionText(activity.action)}
                      </p>
                      
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-[#ADADB8]">
                          by <span className="text-white">{activity.user_email || activity.user_id}</span>
                        </p>
                        
                        {activity.resource_id && (
                          <>
                            <span className="text-[#ADADB8]">•</span>
                            <p className="text-xs text-[#ADADB8]">
                              {activity.resource_type}: {activity.resource_id}
                            </p>
                          </>
                        )}
                      </div>
                      
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <div className="mt-2 text-xs text-[#ADADB8]">
                          {Object.entries(activity.details)
                            .slice(0, 2)
                            .map(([key, value]) => (
                              <div key={key} className="inline-block mr-3">
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end space-y-1">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs border",
                          getSeverityBadgeColor(activity.severity)
                        )}
                      >
                        {activity.severity}
                      </Badge>
                      
                      <div className="flex items-center text-xs text-[#ADADB8]">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeAgo}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {activities.length > limit && (
        <div className="flex justify-center pt-2 border-t border-[#26262c]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-[#ADADB8] hover:text-white hover:bg-[#26262c] text-xs"
          >
            {showAll ? 'Show Less' : `Show All (${activities.length})`}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}