"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Database, 
  Server, 
  Activity,
  Wifi,
  HardDrive,
  Cpu,
  MemoryStick,
  Network
} from 'lucide-react';

interface SystemHealthCardProps {
  health: {
    database: 'healthy' | 'warning' | 'critical';
    api: 'healthy' | 'warning' | 'critical';
    data_collection: 'healthy' | 'warning' | 'critical';
  };
  metrics?: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_latency?: number;
  };
}

export function SystemHealthCard({ 
  health, 
  metrics = {
    cpu_usage: 45,
    memory_usage: 62,
    disk_usage: 78,
    network_latency: 12
  }
}: SystemHealthCardProps) {
  
  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle2;
      case 'warning': return AlertTriangle;
      case 'critical': return XCircle;
      default: return AlertTriangle;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-400';
      case 'warning': return 'text-amber-400';
      case 'critical': return 'text-red-400';
      default: return 'text-[#ADADB8]';
    }
  };

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'border-emerald-400/30 text-emerald-400 bg-emerald-400/10';
      case 'warning': return 'border-amber-400/30 text-amber-400 bg-amber-400/10';
      case 'critical': return 'border-red-400/30 text-red-400 bg-red-400/10';
      default: return 'border-[#40404a] text-[#ADADB8] bg-[#26262c]/30';
    }
  };

  const getProgressColor = (value: number) => {
    if (value < 50) return 'bg-emerald-500';
    if (value < 80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getOverallHealth = () => {
    const statuses = Object.values(health);
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  };

  const healthComponents = [
    {
      id: 'database',
      label: 'Database',
      icon: Database,
      status: health.database,
      description: 'PostgreSQL connection and performance'
    },
    {
      id: 'api',
      label: 'API Services',
      icon: Server,
      status: health.api,
      description: 'REST API endpoints and middleware'
    },
    {
      id: 'data_collection',
      label: 'Data Collection',
      icon: Activity,
      status: health.data_collection,
      description: 'Automated data ingestion processes'
    },
    {
      id: 'network',
      label: 'Network',
      icon: Network,
      status: 'healthy' as const,
      description: 'Network connectivity and latency'
    }
  ];

  const performanceMetrics = [
    {
      label: 'CPU Usage',
      icon: Cpu,
      value: metrics.cpu_usage || 45,
      unit: '%',
      description: 'Server CPU utilization'
    },
    {
      label: 'Memory',
      icon: MemoryStick,
      value: metrics.memory_usage || 62,
      unit: '%',
      description: 'RAM usage across services'
    },
    {
      label: 'Storage',
      icon: HardDrive,
      value: metrics.disk_usage || 78,
      unit: '%',
      description: 'Database and file storage'
    },
    {
      label: 'Network',
      icon: Wifi,
      value: metrics.network_latency || 12,
      unit: 'ms',
      description: 'Average response latency'
    }
  ];

  const overallHealth = getOverallHealth();
  const OverallIcon = getHealthIcon(overallHealth);

  return (
    <div className="space-y-6">
      {/* Overall System Health */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full bg-[#26262c] ${getHealthColor(overallHealth)}`}>
                <OverallIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white">System Health</CardTitle>
                <CardDescription className="text-[#ADADB8]">
                  Overall system status and performance
                </CardDescription>
              </div>
            </div>
            
            <Badge variant="outline" className={getHealthBadgeColor(overallHealth)}>
              {overallHealth === 'healthy' ? 'All Systems Operational' : 
               overallHealth === 'warning' ? 'Minor Issues Detected' : 
               'Critical Issues Require Attention'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Component Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {healthComponents.map((component) => {
          const Icon = component.icon;
          const StatusIcon = getHealthIcon(component.status);
          
          return (
            <Card key={component.id} className="bg-[#1a1a1e] border-[#26262c]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-[#26262c]">
                      <Icon className="h-4 w-4 text-[#ADADB8]" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{component.label}</h4>
                      <p className="text-xs text-[#ADADB8]">{component.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <StatusIcon className={`h-4 w-4 ${getHealthColor(component.status)}`} />
                    <Badge variant="outline" className={`text-xs ${getHealthBadgeColor(component.status)}`}>
                      {component.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Metrics */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader>
          <CardTitle className="text-white">Performance Metrics</CardTitle>
          <CardDescription className="text-[#ADADB8]">
            Real-time system resource utilization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {performanceMetrics.map((metric) => {
            const Icon = metric.icon;
            
            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-[#ADADB8]" />
                    <span className="text-sm font-medium text-white">{metric.label}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white font-mono">
                      {metric.value}{metric.unit}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={
                        metric.unit === '%' 
                          ? metric.value < 50 
                            ? 'border-emerald-400/30 text-emerald-400' 
                            : metric.value < 80 
                              ? 'border-amber-400/30 text-amber-400' 
                              : 'border-red-400/30 text-red-400'
                          : metric.value < 50 
                            ? 'border-emerald-400/30 text-emerald-400' 
                            : 'border-amber-400/30 text-amber-400'
                      }
                    >
                      {metric.unit === '%' 
                        ? metric.value < 50 ? 'Good' : metric.value < 80 ? 'Moderate' : 'High'
                        : metric.value < 50 ? 'Excellent' : 'Good'
                      }
                    </Badge>
                  </div>
                </div>
                
                {metric.unit === '%' && (
                  <div className="relative">
                    <Progress 
                      value={metric.value} 
                      className="h-2 bg-[#26262c]"
                    />
                    <div 
                      className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${getProgressColor(metric.value)}`}
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                )}
                
                <p className="text-xs text-[#ADADB8]">{metric.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Health Actions */}
      {overallHealth !== 'healthy' && (
        <Card className="bg-[#1a1a1e] border-[#26262c]">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span>Recommended Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overallHealth === 'critical' && (
              <div className="p-3 bg-red-400/10 border border-red-400/20 rounded">
                <p className="text-red-400 text-sm font-medium mb-2">Critical Issues Detected</p>
                <ul className="text-red-300 text-sm space-y-1">
                  <li>• Check database connectivity and performance</li>
                  <li>• Review system logs for errors</li>
                  <li>• Contact system administrator immediately</li>
                </ul>
              </div>
            )}
            
            {overallHealth === 'warning' && (
              <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded">
                <p className="text-amber-400 text-sm font-medium mb-2">Minor Issues Detected</p>
                <ul className="text-amber-300 text-sm space-y-1">
                  <li>• Monitor system performance closely</li>
                  <li>• Consider optimizing database queries</li>
                  <li>• Review resource usage patterns</li>
                </ul>
              </div>
            )}
            
            <div className="flex items-center space-x-2 pt-2">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
              >
                Run Diagnostics
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
              >
                View Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}