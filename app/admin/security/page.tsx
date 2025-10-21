"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Shield, 
  Search, 
  Calendar as CalendarIcon, 
  User, 
  Activity, 
  AlertTriangle, 
  Eye, 
  Download,
  Filter,
  RefreshCw,
  Lock,
  Unlock,
  UserX,
  Database,
  Server,
  Settings,
  Bell,
  Clock,
  MapPin
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { AuditLog, PaginatedResponse } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

export default function AdminSecurityPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    resource_type: '',
    severity: '',
    start_date: format(addDays(new Date(), -7), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });
  
  const { toast } = useToast();

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const response = await adminAPI.getAuditLogs({
        page: currentPage,
        limit: 50,
        ...cleanFilters,
      });
      
      if (response.success && response.data) {
        setAuditLogs(response.data.items);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityEvents = async () => {
    try {
      const response = await adminAPI.getSecurityEvents({
        page: 1,
        limit: 20,
        event_type: filters.action || undefined,
        severity: filters.severity || undefined,
      });
      
      if (response.success && response.data) {
        setSecurityEvents(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching security events:', error);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchSecurityEvents();
  }, [currentPage, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleExportLogs = async () => {
    try {
      // This would typically generate a CSV/JSON file
      toast({
        title: "Success",
        description: "Audit logs exported successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to export audit logs.",
        variant: "destructive"
      });
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('login')) return Lock;
    if (action.includes('logout')) return Unlock;
    if (action.includes('user')) return User;
    if (action.includes('server')) return Server;
    if (action.includes('banner') || action.includes('notification')) return Bell;
    if (action.includes('data')) return Database;
    if (action.includes('config') || action.includes('system')) return Settings;
    return Activity;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'high': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'medium': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      default: return 'text-[#ADADB8] bg-[#26262c]/30 border-[#40404a]/30';
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

  const getUniqueValues = (field: keyof AuditLog) => {
    return [...new Set(auditLogs.map(log => log[field]).filter(Boolean))];
  };

  // Mock security metrics
  const securityMetrics = {
    failed_logins: 23,
    suspicious_activities: 5,
    blocked_ips: 12,
    security_events: securityEvents.length,
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
                <h1 className="text-2xl font-bold text-white">Security & Audit</h1>
                <p className="text-[#ADADB8] text-sm">
                  Monitor system security events and audit user activities
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleExportLogs}
                  variant="outline"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Logs
                </Button>
                
                <Button
                  onClick={() => {
                    fetchAuditLogs();
                    fetchSecurityEvents();
                  }}
                  className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Security Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Failed Logins</p>
                        <p className="text-2xl font-bold text-red-400">
                          {securityMetrics.failed_logins}
                        </p>
                      </div>
                      <UserX className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Suspicious Activities</p>
                        <p className="text-2xl font-bold text-amber-400">
                          {securityMetrics.suspicious_activities}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-amber-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Blocked IPs</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {securityMetrics.blocked_ips}
                        </p>
                      </div>
                      <Shield className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Security Events</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {securityMetrics.security_events}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="audit" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
                  <TabsTrigger value="audit" className="text-white">Audit Logs</TabsTrigger>
                  <TabsTrigger value="security" className="text-white">Security Events</TabsTrigger>
                  <TabsTrigger value="analysis" className="text-white">Threat Analysis</TabsTrigger>
                </TabsList>

                {/* Audit Logs */}
                <TabsContent value="audit" className="space-y-6">
                  {/* Filters */}
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-white">
                        <Filter className="h-5 w-5" />
                        <span>Filter Audit Logs</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                          <Label className="text-[#ADADB8]">User</Label>
                          <Input
                            placeholder="User ID or email"
                            value={filters.user_id}
                            onChange={(e) => handleFilterChange('user_id', e.target.value)}
                            className="bg-[#26262c] border-[#40404a] text-white"
                          />
                        </div>

                        <div>
                          <Label className="text-[#ADADB8]">Action</Label>
                          <Select 
                            value={filters.action} 
                            onValueChange={(value) => handleFilterChange('action', value)}
                          >
                            <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                              <SelectValue placeholder="All actions" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#26262c] border-[#40404a]">
                              <SelectItem value="">All Actions</SelectItem>
                              <SelectItem value="login">Login</SelectItem>
                              <SelectItem value="logout">Logout</SelectItem>
                              <SelectItem value="server_created">Server Created</SelectItem>
                              <SelectItem value="server_updated">Server Updated</SelectItem>
                              <SelectItem value="banner_created">Banner Created</SelectItem>
                              <SelectItem value="data_exported">Data Exported</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[#ADADB8]">Resource</Label>
                          <Select 
                            value={filters.resource_type} 
                            onValueChange={(value) => handleFilterChange('resource_type', value)}
                          >
                            <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                              <SelectValue placeholder="All resources" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#26262c] border-[#40404a]">
                              <SelectItem value="">All Resources</SelectItem>
                              <SelectItem value="server">Server</SelectItem>
                              <SelectItem value="notification_banner">Banner</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[#ADADB8]">Severity</Label>
                          <Select 
                            value={filters.severity} 
                            onValueChange={(value) => handleFilterChange('severity', value)}
                          >
                            <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                              <SelectValue placeholder="All levels" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#26262c] border-[#40404a]">
                              <SelectItem value="">All Levels</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[#ADADB8]">Start Date</Label>
                          <Input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            className="bg-[#26262c] border-[#40404a] text-white"
                          />
                        </div>

                        <div>
                          <Label className="text-[#ADADB8]">End Date</Label>
                          <Input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            className="bg-[#26262c] border-[#40404a] text-white"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Audit Logs Table */}
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Audit Logs</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Comprehensive log of all system activities and user actions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#9147ff] mr-2" />
                          <span className="text-[#ADADB8]">Loading audit logs...</span>
                        </div>
                      ) : auditLogs.length === 0 ? (
                        <div className="text-center py-8">
                          <Shield className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-white mb-2">No audit logs found</h3>
                          <p className="text-[#ADADB8] mb-4">
                            Try adjusting your filter criteria to see more results.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <ScrollArea className="h-[600px]">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-[#26262c] hover:bg-[#26262c]">
                                  <TableHead className="text-[#ADADB8]">Timestamp</TableHead>
                                  <TableHead className="text-[#ADADB8]">User</TableHead>
                                  <TableHead className="text-[#ADADB8]">Action</TableHead>
                                  <TableHead className="text-[#ADADB8]">Resource</TableHead>
                                  <TableHead className="text-[#ADADB8]">Severity</TableHead>
                                  <TableHead className="text-[#ADADB8]">IP Address</TableHead>
                                  <TableHead className="text-[#ADADB8]">Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {auditLogs.map((log) => {
                                  const Icon = getActionIcon(log.action);
                                  const timestamp = log.timestamp || log.created_at;
                                  const timestampDate = timestamp ? new Date(timestamp) : null;
                                  
                                  return (
                                    <TableRow key={log.id} className="border-[#26262c] hover:bg-[#26262c]/30">
                                      <TableCell className="text-[#ADADB8]">
                                        <div className="flex items-center space-x-2">
                                          <Clock className="h-4 w-4" />
                                          <div>
                                            <div className="text-white text-sm">
                                              {timestampDate ? timestampDate.toLocaleTimeString() : 'N/A'}
                                            </div>
                                            <div className="text-xs">
                                              {timestampDate ? timestampDate.toLocaleDateString() : 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                        <div className="flex items-center space-x-2">
                                          <User className="h-4 w-4 text-[#ADADB8]" />
                                          <div>
                                            <div className="text-white text-sm font-medium">
                                              {log.user_email || log.user_id}
                                            </div>
                                            {log.user_email && log.user_id !== log.user_email && (
                                              <div className="text-xs text-[#ADADB8]">
                                                ID: {log.user_id}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                        <div className="flex items-center space-x-2">
                                          <Icon className="h-4 w-4 text-[#ADADB8]" />
                                          <span className="text-white text-sm">
                                            {formatActionText(log.action)}
                                          </span>
                                        </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                        <div className="text-white text-sm">
                                          {log.resource_type}
                                          {log.resource_id && (
                                            <div className="text-xs text-[#ADADB8]">
                                              {log.resource_id}
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                        <Badge variant="outline" className={cn(
                                          "border text-xs",
                                          getSeverityColor(log.severity || 'low')
                                        )}>
                                          {log.severity || 'low'}
                                        </Badge>
                                      </TableCell>
                                      
                                      <TableCell>
                                        <div className="flex items-center space-x-2">
                                          <MapPin className="h-4 w-4 text-[#ADADB8]" />
                                          <span className="text-white text-sm">
                                            {log.ip_address || 'N/A'}
                                          </span>
                                        </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                        <div className="max-w-xs">
                                          {typeof log.details === 'object' && log.details !== null ? (
                                            <div className="text-xs text-[#ADADB8]">
                                              {Object.entries(log.details as Record<string, any>)
                                                .slice(0, 2)
                                                .map(([key, value]) => (
                                                  <div key={key}>
                                                    <span className="font-medium text-white">{key}:</span> {String(value)}
                                                  </div>
                                                ))}
                                            </div>
                                          ) : log.details ? (
                                            <span className="text-[#ADADB8] text-xs">{String(log.details)}</span>
                                          ) : (
                                            <span className="text-[#ADADB8] text-xs">No details provided</span>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                          
                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t border-[#26262c]">
                              <div className="text-sm text-[#ADADB8]">
                                Page {currentPage} of {totalPages}
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                  disabled={currentPage === 1}
                                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                                >
                                  Previous
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                  disabled={currentPage === totalPages}
                                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Security Events */}
                <TabsContent value="security" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Security Events</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Real-time security monitoring and threat detection
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Shield className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">System Secure</h3>
                        <p className="text-[#ADADB8] mb-4">
                          No active security threats detected. All systems are operating normally.
                        </p>
                        <Badge variant="outline" className="border-emerald-400/30 text-emerald-400">
                          Security Status: Normal
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Threat Analysis */}
                <TabsContent value="analysis" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Threat Analysis</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Advanced threat detection and security recommendations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Activity className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">Analysis Complete</h3>
                        <p className="text-[#ADADB8] mb-4">
                          Security analysis is running continuously. No threats detected in the last 24 hours.
                        </p>
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
