"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Users, 
  Activity, 
  Database, 
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { SystemMetrics } from '@/lib/admin-types';

interface SystemMetricsCardProps {
  metrics: SystemMetrics;
}

export function SystemMetricsCard({ metrics }: SystemMetricsCardProps) {
  const formatBytes = (bytes: string) => {
    // If already formatted (like "2.4 GB"), return as is
    if (typeof bytes === 'string' && bytes.includes(' ')) {
      return bytes;
    }
    
    // Otherwise try to parse and format
    const numBytes = parseFloat(bytes);
    if (isNaN(numBytes)) return bytes;
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = numBytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const getErrorRateColor = (errorRate: number) => {
    if (errorRate < 1) return 'text-emerald-400';
    if (errorRate < 3) return 'text-amber-400';
    return 'text-red-400';
  };

  const getErrorRateIcon = (errorRate: number) => {
    if (errorRate < 1) return TrendingDown;
    if (errorRate < 3) return Minus;
    return TrendingUp;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Servers */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-[#ADADB8]">
            Total Servers
          </CardTitle>
          <Server className="h-4 w-4 text-[#ADADB8]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white mb-1">
            {metrics.total_servers}
          </div>
          <p className="text-xs text-[#ADADB8]">
            Active monitoring targets
          </p>
        </CardContent>
      </Card>

      {/* Players Today */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-[#ADADB8]">
            Players Today
          </CardTitle>
          <Users className="h-4 w-4 text-[#ADADB8]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-400 mb-1">
            {formatNumber(metrics.total_players_today)}
          </div>
          <div className="flex items-center space-x-1 text-xs text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>Active sessions</span>
          </div>
        </CardContent>
      </Card>

      {/* API Requests */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-[#ADADB8]">
            API Requests
          </CardTitle>
          <Activity className="h-4 w-4 text-[#ADADB8]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {formatNumber(metrics.api_requests_today)}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#ADADB8]">Today</span>
            <div className={`flex items-center space-x-1 ${getErrorRateColor(metrics.error_rate)}`}>
              {(() => {
                const ErrorIcon = getErrorRateIcon(metrics.error_rate);
                return <ErrorIcon className="h-3 w-3" />;
              })()}
              <span>{metrics.error_rate}% errors</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Size */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-[#ADADB8]">
            Database
          </CardTitle>
          <Database className="h-4 w-4 text-[#ADADB8]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-400 mb-1">
            {formatBytes(metrics.database_size)}
          </div>
          <p className="text-xs text-[#ADADB8]">
            {formatNumber(metrics.total_data_points)} records
          </p>
        </CardContent>
      </Card>

      {/* System Uptime */}
      <Card className="bg-[#1a1a1e] border-[#26262c] md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-[#ADADB8]">
            System Uptime
          </CardTitle>
          <Clock className="h-4 w-4 text-[#ADADB8]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-400 mb-2">
            {metrics.system_uptime}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#ADADB8]">Availability</span>
              <span className="text-emerald-400">99.9%</span>
            </div>
            <Progress value={99.9} className="h-2 bg-[#26262c]" />
          </div>
        </CardContent>
      </Card>

      {/* Active Banners */}
      <Card className="bg-[#1a1a1e] border-[#26262c] md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-[#ADADB8]">
            Active Notifications
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge 
              variant="outline" 
              className="border-[#9147ff]/30 text-[#9147ff] text-xs"
            >
              {metrics.active_banners} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-[#9147ff] mb-1">
                {metrics.active_banners}
              </div>
              <p className="text-xs text-[#ADADB8]">
                Notification banners live
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-white mb-1">
                System Status
              </div>
              <Badge variant="outline" className="border-emerald-400/30 text-emerald-400 text-xs">
                Operational
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}