"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Calendar as CalendarIcon,
  FileText,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  Zap,
  TrendingUp,
  Server,
  Users
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { DataCollectionStatus, APIUsageMetrics } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

export default function AdminDataPage() {
  const [dataStatus, setDataStatus] = useState<DataCollectionStatus[]>([]);
  const [apiMetrics, setApiMetrics] = useState<APIUsageMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Export form state
  const [exportDialog, setExportDialog] = useState(false);
  const [exportForm, setExportForm] = useState({
    server_ids: [] as string[],
    start_date: format(addDays(new Date(), -30), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    format: 'csv' as 'csv' | 'json',
    data_types: ['player_counts'] as ('player_counts' | 'stream_data' | 'viewer_data')[],
  });
  
  // Delete form state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    server_ids: [] as string[],
    start_date: format(addDays(new Date(), -30), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    data_types: [] as ('player_counts' | 'stream_data' | 'viewer_data')[],
  });

  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  
  const { toast } = useToast();

  const fetchDataStatus = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDataCollectionStatus();
      if (response.success && response.data) {
        setDataStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching data status:', error);
      toast({
        title: "Error",
        description: "Failed to load data collection status.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAPIMetrics = async () => {
    try {
      const response = await adminAPI.getAPIUsageMetrics(selectedTimeRange);
      if (response.success && response.data) {
        setApiMetrics(response.data);
      }
    } catch (error) {
      console.error('Error fetching API metrics:', error);
    }
  };

  useEffect(() => {
    fetchDataStatus();
    fetchAPIMetrics();
  }, [selectedTimeRange]);

  const handleTriggerCollection = async (serverId?: string) => {
    setCollectionLoading(true);
    try {
      const response = await adminAPI.triggerDataCollection(serverId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Data collection triggered successfully.",
        });
        fetchDataStatus();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger data collection.",
        variant: "destructive"
      });
    } finally {
      setCollectionLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const response = await adminAPI.exportData(exportForm);
      if (response.success && response.data) {
        // Create download link
        const link = document.createElement('a');
        link.href = response.data.download_url;
        link.download = `data_export_${format(new Date(), 'yyyy-MM-dd')}.${exportForm.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Success",
          description: "Data export completed successfully.",
        });
        setExportDialog(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export data.",
        variant: "destructive"
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteData = async () => {
    setDeleteLoading(true);
    try {
      const response = await adminAPI.deleteDataRange(deleteForm);
      if (response.success && response.data) {
        toast({
          title: "Success",
          description: `${response.data.deleted_records} records deleted successfully.`,
        });
        setDeleteDialog(false);
        fetchDataStatus();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete data.",
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'inactive': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default: return <Activity className="h-4 w-4 text-[#ADADB8]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'inactive': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'error': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-[#ADADB8] bg-[#26262c]/30 border-[#40404a]/30';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateTotalRecords = () => {
    return dataStatus.reduce((sum, server) => sum + server.total_records, 0);
  };

  const calculateActiveServers = () => {
    return dataStatus.filter(server => server.status === 'active').length;
  };

  const getAverageSuccessRate = () => {
    if (apiMetrics.length === 0) return 0;
    return Math.round(apiMetrics.reduce((sum, metric) => sum + metric.success_rate, 0) / apiMetrics.length);
  };

  const getTotalAPIRequests = () => {
    return apiMetrics.reduce((sum, metric) => sum + metric.total_requests, 0);
  };

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10]">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Data Management</h1>
                <p className="text-[#ADADB8] text-sm">
                  Monitor data collection, analytics, and system performance
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => handleTriggerCollection()}
                  disabled={collectionLoading}
                  className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", collectionLoading && "animate-spin")} />
                  Trigger Collection
                </Button>
                
                <Button
                  onClick={() => setExportDialog(true)}
                  variant="outline"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Data Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Records</p>
                        <p className="text-2xl font-bold text-white">
                          {calculateTotalRecords().toLocaleString()}
                        </p>
                      </div>
                      <Database className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Active Servers</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {calculateActiveServers()}/{dataStatus.length}
                        </p>
                      </div>
                      <Server className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">API Success Rate</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {getAverageSuccessRate()}%
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">API Requests</p>
                        <p className="text-2xl font-bold text-amber-400">
                          {getTotalAPIRequests().toLocaleString()}
                        </p>
                      </div>
                      <Zap className="h-8 w-8 text-amber-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="collection" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
                  <TabsTrigger value="collection" className="text-white">Data Collection</TabsTrigger>
                  <TabsTrigger value="analytics" className="text-white">API Analytics</TabsTrigger>
                  <TabsTrigger value="management" className="text-white">Data Management</TabsTrigger>
                </TabsList>

                {/* Data Collection Status */}
                <TabsContent value="collection" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Collection Status</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Monitor data collection from all configured servers
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#9147ff] mr-2" />
                          <span className="text-[#ADADB8]">Loading collection status...</span>
                        </div>
                      ) : dataStatus.length === 0 ? (
                        <div className="text-center py-8">
                          <Database className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-white mb-2">No Data Collection Configured</h3>
                          <p className="text-[#ADADB8] mb-4">
                            Set up servers to start collecting data automatically.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {dataStatus.map((server) => (
                            <div key={server.server_id} className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center space-x-2">
                                    {getStatusIcon(server.status)}
                                    <div>
                                      <h4 className="font-medium text-white">{server.server_name}</h4>
                                      <p className="text-sm text-[#ADADB8]">ID: {server.server_id}</p>
                                    </div>
                                  </div>
                                  
                                  <Badge variant="outline" className={cn("border", getStatusColor(server.status))}>
                                    {server.status}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center space-x-6 text-sm">
                                  <div className="text-center">
                                    <p className="text-white font-medium">{server.total_records.toLocaleString()}</p>
                                    <p className="text-[#ADADB8]">Records</p>
                                  </div>
                                  
                                  <div className="text-center">
                                    <p className="text-white font-medium">
                                      {new Date(server.last_collection).toLocaleString()}
                                    </p>
                                    <p className="text-[#ADADB8]">Last Collection</p>
                                  </div>
                                  
                                  <div className="text-center">
                                    <p className="text-white font-medium">{server.collection_frequency}</p>
                                    <p className="text-[#ADADB8]">Frequency</p>
                                  </div>
                                  
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTriggerCollection(server.server_id)}
                                    disabled={collectionLoading}
                                    className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                                  >
                                    <RefreshCw className={cn("h-4 w-4", collectionLoading && "animate-spin")} />
                                  </Button>
                                </div>
                              </div>
                              
                              {server.errors.length > 0 && (
                                <div className="mt-3 p-3 bg-red-400/10 border border-red-400/20 rounded">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-red-400" />
                                    <span className="text-red-400 font-medium">Recent Errors</span>
                                  </div>
                                  {server.errors.slice(0, 2).map((error) => (
                                    <div key={error.id} className="text-sm text-red-300 mb-1">
                                      <span className="font-medium">{error.error_type}:</span> {error.error_message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* API Analytics */}
                <TabsContent value="analytics" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">API Performance</h3>
                      <p className="text-[#ADADB8] text-sm">Monitor API endpoint usage and performance metrics</p>
                    </div>
                    
                    <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                      <SelectTrigger className="w-[150px] bg-[#26262c] border-[#40404a] text-white">
                        <SelectValue placeholder="Time range" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#26262c] border-[#40404a]">
                        <SelectItem value="1h">Last Hour</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {apiMetrics.map((metric) => (
                      <Card key={`${metric.endpoint}-${metric.method}`} className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm text-white">
                                {metric.method} {metric.endpoint}
                              </CardTitle>
                              <CardDescription className="text-[#ADADB8]">
                                Last accessed: {new Date(metric.last_accessed).toLocaleString()}
                              </CardDescription>
                            </div>
                            
                            <Badge variant="outline" className={cn(
                              "border",
                              metric.success_rate >= 95 ? "border-emerald-400/30 text-emerald-400" :
                              metric.success_rate >= 90 ? "border-amber-400/30 text-amber-400" :
                              "border-red-400/30 text-red-400"
                            )}>
                              {metric.success_rate}% Success
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-[#ADADB8]">Total Requests</p>
                              <p className="text-white font-medium">{metric.total_requests.toLocaleString()}</p>
                            </div>
                            
                            <div>
                              <p className="text-[#ADADB8]">Avg Response Time</p>
                              <p className="text-white font-medium">{metric.average_response_time}ms</p>
                            </div>
                            
                            <div>
                              <p className="text-[#ADADB8]">Errors (24h)</p>
                              <p className="text-white font-medium">{metric.errors_24h}</p>
                            </div>
                            
                            <div>
                              <p className="text-[#ADADB8]">Success Rate</p>
                              <Progress 
                                value={metric.success_rate} 
                                className="w-full h-2 bg-[#26262c]"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Data Management */}
                <TabsContent value="management" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-white">
                          <Download className="h-5 w-5" />
                          <span>Export Data</span>
                        </CardTitle>
                        <CardDescription className="text-[#ADADB8]">
                          Export historical data in various formats
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={() => setExportDialog(true)}
                          className="w-full bg-[#9147ff] hover:bg-[#772ce8] text-white"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Configure Export
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-white">
                          <Upload className="h-5 w-5" />
                          <span>Import Data</span>
                        </CardTitle>
                        <CardDescription className="text-[#ADADB8]">
                          Import data from external sources
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="outline"
                          className="w-full bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Import File
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-white">
                          <Trash2 className="h-5 w-5" />
                          <span>Delete Data</span>
                        </CardTitle>
                        <CardDescription className="text-[#ADADB8]">
                          Remove old or unwanted data
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="outline"
                          onClick={() => setDeleteDialog(true)}
                          className="w-full border-red-400/30 text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Range
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* Export Data Dialog */}
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription className="text-[#ADADB8]">
              Configure your data export settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-white">Date Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  type="date"
                  value={exportForm.start_date}
                  onChange={(e) => setExportForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
                <Input
                  type="date"
                  value={exportForm.end_date}
                  onChange={(e) => setExportForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-white">Format</Label>
              <Select 
                value={exportForm.format} 
                onValueChange={(value: 'csv' | 'json') => setExportForm(prev => ({ ...prev, format: value }))}
              >
                <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#26262c] border-[#40404a]">
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white">Data Types</Label>
              <div className="space-y-2 mt-2">
                {['player_counts', 'stream_data', 'viewer_data'].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={exportForm.data_types.includes(type as 'player_counts' | 'stream_data' | 'viewer_data')}
                      onCheckedChange={(checked) => {
                        const dataType = type as 'player_counts' | 'stream_data' | 'viewer_data';
                        if (checked) {
                          setExportForm(prev => ({
                            ...prev,
                            data_types: [...prev.data_types, dataType]
                          }));
                        } else {
                          setExportForm(prev => ({
                            ...prev,
                            data_types: prev.data_types.filter(t => t !== dataType)
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={type} className="text-white capitalize">
                      {type.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setExportDialog(false)}
              className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleExportData}
              disabled={exportLoading || exportForm.data_types.length === 0}
              className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
            >
              {exportLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Data Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="bg-[#1a1a1e] border-[#26262c]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Data Range</AlertDialogTitle>
            <AlertDialogDescription className="text-[#ADADB8]">
              This action cannot be undone. Please specify the data range to delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-white">Date Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  type="date"
                  value={deleteForm.start_date}
                  onChange={(e) => setDeleteForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
                <Input
                  type="date"
                  value={deleteForm.end_date}
                  onChange={(e) => setDeleteForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-white">Data Types to Delete</Label>
              <div className="space-y-2 mt-2">
                {['player_counts', 'stream_data', 'viewer_data'].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`delete_${type}`}
                      checked={deleteForm.data_types.includes(type as 'player_counts' | 'stream_data' | 'viewer_data')}
                      onCheckedChange={(checked) => {
                        const dataType = type as 'player_counts' | 'stream_data' | 'viewer_data';
                        if (checked) {
                          setDeleteForm(prev => ({
                            ...prev,
                            data_types: [...prev.data_types, dataType]
                          }));
                        } else {
                          setDeleteForm(prev => ({
                            ...prev,
                            data_types: prev.data_types.filter(t => t !== dataType)
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={`delete_${type}`} className="text-white capitalize">
                      {type.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteData}
              disabled={deleteLoading || deleteForm.data_types.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Data'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminProtected>
  );
}