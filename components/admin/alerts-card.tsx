"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  AlertTriangle, 
  Info, 
  XCircle, 
  CheckCircle2, 
  X,
  Clock,
  AlertCircle
} from 'lucide-react';
import { SystemAlert } from '@/lib/admin-types';
import { adminAPI } from '@/lib/admin-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AlertsCardProps {
  alerts: SystemAlert[];
  onAlertUpdate?: () => void;
}

export function AlertsCard({ alerts, onAlertUpdate }: AlertsCardProps) {
  const [dismissingAlert, setDismissingAlert] = useState<string | null>(null);
  const [resolvingAlert, setResolvingAlert] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const { toast } = useToast();

  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);
  const displayedAlerts = showResolved ? alerts : unresolvedAlerts;

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === 'critical') return AlertTriangle;
    
    switch (type) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return AlertCircle;
    }
  };

  const getAlertColor = (type: string, severity: string) => {
    if (severity === 'critical') return 'text-red-400 bg-red-400/10 border-red-400/30';
    
    switch (type) {
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'warning': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'info': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-[#ADADB8] bg-[#26262c]/30 border-[#40404a]/30';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-400/50 text-red-400 bg-red-400/20';
      case 'high': return 'border-amber-400/50 text-amber-400 bg-amber-400/20';
      case 'medium': return 'border-blue-400/50 text-blue-400 bg-blue-400/20';
      case 'low': return 'border-emerald-400/50 text-emerald-400 bg-emerald-400/20';
      default: return 'border-[#40404a] text-[#ADADB8] bg-[#26262c]/20';
    }
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

  const handleResolveAlert = async (alertId: string) => {
    setResolvingAlert(alertId);
    try {
      const response = await adminAPI.resolveAlert(alertId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Alert resolved successfully.",
        });
        onAlertUpdate?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve alert.",
        variant: "destructive"
      });
    } finally {
      setResolvingAlert(null);
    }
  };

  const handleDismissAlert = async () => {
    if (!dismissingAlert) return;
    
    try {
      const response = await adminAPI.dismissAlert(dismissingAlert);
      if (response.success) {
        toast({
          title: "Success",
          description: "Alert dismissed successfully.",
        });
        onAlertUpdate?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss alert.",
        variant: "destructive"
      });
    } finally {
      setDismissingAlert(null);
    }
  };

  const getCriticalAlertsCount = () => {
    return unresolvedAlerts.filter(alert => alert.severity === 'critical').length;
  };

  if (!alerts || alerts.length === 0) {
    return (
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>System Alerts</span>
          </CardTitle>
          <CardDescription className="text-[#ADADB8]">
            All systems operating normally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
            <p className="text-white font-medium mb-1">No Active Alerts</p>
            <p className="text-[#ADADB8] text-sm">
              System is running smoothly with no issues detected.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1a1e] border-[#26262c]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="flex items-center space-x-2 text-white">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span>System Alerts</span>
            </CardTitle>
            
            {getCriticalAlertsCount() > 0 && (
              <Badge variant="destructive" className="ml-2">
                {getCriticalAlertsCount()} Critical
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-[#40404a] text-[#ADADB8]">
              {unresolvedAlerts.length} Active
            </Badge>
            
            {resolvedAlerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResolved(!showResolved)}
                className="text-[#ADADB8] hover:text-white hover:bg-[#26262c] text-xs"
              >
                {showResolved ? 'Hide Resolved' : `Show Resolved (${resolvedAlerts.length})`}
              </Button>
            )}
          </div>
        </div>
        
        <CardDescription className="text-[#ADADB8]">
          {unresolvedAlerts.length > 0 
            ? `${unresolvedAlerts.length} alert${unresolvedAlerts.length !== 1 ? 's' : ''} requiring attention`
            : 'All alerts have been resolved'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {displayedAlerts.map((alert) => {
              const Icon = getAlertIcon(alert.type, alert.severity);
              const timeAgo = formatTimeAgo(alert.timestamp);
              const isResolving = resolvingAlert === alert.id;
              
              return (
                <div 
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all duration-200",
                    getAlertColor(alert.type, alert.severity),
                    alert.resolved && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3 flex-1">
                      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-sm text-white">
                            {alert.title}
                          </h4>
                          
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs border", getSeverityBadgeColor(alert.severity))}
                          >
                            {alert.severity}
                          </Badge>
                          
                          {alert.resolved && (
                            <Badge variant="outline" className="text-xs border-emerald-400/30 text-emerald-400">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm opacity-90 mb-2">
                          {alert.message}
                        </p>
                        
                        <div className="flex items-center text-xs opacity-70">
                          <Clock className="h-3 w-3 mr-1" />
                          {timeAgo}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {!alert.resolved && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id)}
                            disabled={isResolving}
                            className="h-8 w-8 p-0 hover:bg-emerald-400/20 hover:text-emerald-400"
                          >
                            <CheckCircle2 className={cn(
                              "h-4 w-4",
                              isResolving && "animate-spin"
                            )} />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDismissingAlert(alert.id)}
                            className="h-8 w-8 p-0 hover:bg-red-400/20 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Dismiss Alert Confirmation Dialog */}
      <AlertDialog open={!!dismissingAlert} onOpenChange={() => setDismissingAlert(null)}>
        <AlertDialogContent className="bg-[#1a1a1e] border-[#26262c]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Dismiss Alert</AlertDialogTitle>
            <AlertDialogDescription className="text-[#ADADB8]">
              Are you sure you want to dismiss this alert? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDismissAlert}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Dismiss Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}