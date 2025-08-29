"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Wrench, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Server,
  Zap,
  Activity,
  Settings,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { MaintenanceTask, SystemHealth } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminMaintenancePage() {
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchMaintenanceInfo = async () => {
    try {
      setLoading(true);
      
      // Fetch maintenance tasks
      const tasksResponse = await adminAPI.getMaintenanceTasks();
      if (tasksResponse.success && tasksResponse.data) {
        setMaintenanceTasks(tasksResponse.data);
      }

      // Fetch system health
      const healthResponse = await adminAPI.getSystemHealth();
      if (healthResponse.success && healthResponse.data) {
        setSystemHealth(healthResponse.data);
      }

      // Check maintenance mode status
      const modeResponse = await adminAPI.getMaintenanceMode();
      if (modeResponse.success && modeResponse.data) {
        setMaintenanceMode(modeResponse.data.enabled);
      }
    } catch (error) {
      console.error('Error fetching maintenance info:', error);
      toast({
        title: "Error",
        description: "Failed to load maintenance information.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceInfo();
  }, []);

  const handleToggleMaintenanceMode = async () => {
    try {
      const response = await adminAPI.setMaintenanceMode(!maintenanceMode);
      if (response.success) {
        setMaintenanceMode(!maintenanceMode);
        toast({
          title: "Success",
          description: `Maintenance mode ${!maintenanceMode ? 'enabled' : 'disabled'}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle maintenance mode.",
        variant: "destructive"
      });
    }
  };

  const handleRunTask = async (taskId: string) => {
    try {
      setRunningTasks(prev => new Set(prev).add(taskId));
      const response = await adminAPI.runMaintenanceTask(taskId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Maintenance task completed successfully.",
        });
        fetchMaintenanceInfo();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run maintenance task.",
        variant: "destructive"
      });
    } finally {
      setRunningTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
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

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading maintenance tools...</span>
            </div>
          </div>
        </div>
      </AdminProtected>
    );
  }

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10]">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <Wrench className="mr-3 h-6 w-6" />
                  System Maintenance
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Monitor system health and run maintenance tasks
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="maintenance-mode" className="text-white">
                    Maintenance Mode
                  </Label>
                  <Switch
                    id="maintenance-mode"
                    checked={maintenanceMode}
                    onCheckedChange={handleToggleMaintenanceMode}
                  />
                </div>
                
                <Button 
                  onClick={fetchMaintenanceInfo}
                  variant="outline"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Maintenance Mode Banner */}
          {maintenanceMode && (
            <div className="bg-amber-600/20 border-b border-amber-600/30 px-6 py-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span className="text-amber-300 font-medium">
                  Maintenance mode is currently enabled. Users may experience limited functionality.
                </span>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* System Health Overview */}
              {systemHealth && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Overall Health</p>
                          <div className={cn("flex items-center space-x-2 mt-1", getHealthColor(systemHealth.overall_status))}>
                            {getHealthIcon(systemHealth.overall_status)}
                            <p className="font-medium capitalize">{systemHealth.overall_status}</p>
                          </div>
                        </div>
                        <Activity className={cn("h-8 w-8", getHealthColor(systemHealth.overall_status))} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Database</p>
                          <div className={cn("flex items-center space-x-2 mt-1", getHealthColor(systemHealth.database_status))}>
                            {getHealthIcon(systemHealth.database_status)}
                            <p className="font-medium capitalize">{systemHealth.database_status}</p>
                          </div>
                        </div>
                        <Database className={cn("h-8 w-8", getHealthColor(systemHealth.database_status))} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">API Services</p>
                          <div className={cn("flex items-center space-x-2 mt-1", getHealthColor(systemHealth.api_status))}>
                            {getHealthIcon(systemHealth.api_status)}
                            <p className="font-medium capitalize">{systemHealth.api_status}</p>
                          </div>
                        </div>
                        <Server className={cn("h-8 w-8", getHealthColor(systemHealth.api_status))} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Uptime</p>
                          <p className="text-xl font-bold text-white">{systemHealth.uptime}</p>
                        </div>
                        <Clock className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
                  <TabsTrigger value="tasks" className="text-white">Maintenance Tasks</TabsTrigger>
                  <TabsTrigger value="logs" className="text-white">System Logs</TabsTrigger>
                  <TabsTrigger value="cleanup" className="text-white">Cleanup Tools</TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Automated Maintenance Tasks</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Run system maintenance and optimization tasks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {maintenanceTasks.length > 0 ? maintenanceTasks.map((task) => (
                          <Card key={task.id} className="bg-[#26262c] border-[#40404a]">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <Settings className="h-5 w-5 text-[#9147ff]" />
                                  <h3 className="font-medium text-white">{task.name}</h3>
                                </div>
                                <Badge variant="outline" className={cn("text-xs", getHealthColor(task.status))}>
                                  {task.status}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-[#ADADB8] mb-3">{task.description}</p>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-[#ADADB8]">
                                  Last run: {task.last_run ? new Date(task.last_run).toLocaleDateString() : 'Never'}
                                </span>
                                
                                <Button
                                  size="sm"
                                  onClick={() => handleRunTask(task.id)}
                                  disabled={runningTasks.has(task.id)}
                                  className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                                >
                                  {runningTasks.has(task.id) ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                      Running
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3 w-3 mr-1" />
                                      Run Task
                                    </>
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )) : (
                          <div className="col-span-2 text-center py-8">
                            <Wrench className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">No maintenance tasks configured</h3>
                            <p className="text-[#ADADB8]">
                              Maintenance tasks will appear here when configured.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="logs" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">System Logs</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        View recent system events and error logs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Activity className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">System Logs</h3>
                        <p className="text-[#ADADB8]">
                          System logs and monitoring will be displayed here.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cleanup" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Cleanup Tools</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Tools for cleaning up old data and optimizing storage
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button
                          variant="outline"
                          className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] h-24 flex flex-col items-center justify-center"
                        >
                          <Database className="h-6 w-6 mb-2" />
                          Clean Old Data
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] h-24 flex flex-col items-center justify-center"
                        >
                          <Zap className="h-6 w-6 mb-2" />
                          Optimize Tables
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] h-24 flex flex-col items-center justify-center"
                        >
                          <RefreshCw className="h-6 w-6 mb-2" />
                          Clear Cache
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}