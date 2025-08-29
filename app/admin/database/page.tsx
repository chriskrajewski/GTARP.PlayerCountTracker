"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Database, 
  RefreshCw,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Server,
  Eye,
  Play,
  Pause
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { DatabaseStatus, DatabaseTable } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';

export default function AdminDatabasePage() {
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDatabaseInfo = async () => {
    try {
      setLoading(true);
      
      // Fetch database status
      const statusResponse = await adminAPI.getDatabaseStatus();
      if (statusResponse.success && statusResponse.data) {
        setDbStatus(statusResponse.data);
      }

      // Fetch table information
      const tablesResponse = await adminAPI.getDatabaseTables();
      if (tablesResponse.success && tablesResponse.data) {
        setTables(tablesResponse.data);
      }
    } catch (error) {
      console.error('Error fetching database info:', error);
      toast({
        title: "Error",
        description: "Failed to load database information.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseInfo();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading database information...</span>
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
                  <Database className="mr-3 h-6 w-6" />
                  Database Tools
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Monitor and manage your Supabase database
                </p>
              </div>
              
              <Button 
                onClick={fetchDatabaseInfo}
                variant="outline"
                className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Database Status */}
              {dbStatus && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Connection Status</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <p className="text-sm font-medium text-emerald-400">Connected</p>
                          </div>
                        </div>
                        <Database className="h-8 w-8 text-emerald-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Database Size</p>
                          <p className="text-2xl font-bold text-white">
                            {formatBytes(dbStatus.size_bytes)}
                          </p>
                        </div>
                        <HardDrive className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Active Connections</p>
                          <p className="text-2xl font-bold text-white">{dbStatus.active_connections}</p>
                        </div>
                        <Activity className="h-8 w-8 text-amber-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[#ADADB8]">Version</p>
                          <p className="text-xl font-bold text-white">{dbStatus.version}</p>
                        </div>
                        <Server className="h-8 w-8 text-purple-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Tabs defaultValue="tables" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
                  <TabsTrigger value="tables" className="text-white">Tables</TabsTrigger>
                  <TabsTrigger value="performance" className="text-white">Performance</TabsTrigger>
                  <TabsTrigger value="maintenance" className="text-white">Maintenance</TabsTrigger>
                </TabsList>

                <TabsContent value="tables" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Database Tables</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Overview of all database tables and their statistics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#26262c]">
                            <TableHead className="text-[#ADADB8]">Table Name</TableHead>
                            <TableHead className="text-[#ADADB8]">Rows</TableHead>
                            <TableHead className="text-[#ADADB8]">Size</TableHead>
                            <TableHead className="text-[#ADADB8]">Last Vacuum</TableHead>
                            <TableHead className="text-[#ADADB8]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tables.length > 0 ? tables.map((table) => (
                            <TableRow key={table.name} className="border-[#26262c] hover:bg-[#26262c]/50">
                              <TableCell className="font-medium text-white">{table.name}</TableCell>
                              <TableCell className="text-[#ADADB8]">
                                {table.row_count?.toLocaleString() || 'N/A'}
                              </TableCell>
                              <TableCell className="text-[#ADADB8]">
                                {table.size_bytes ? formatBytes(table.size_bytes) : 'N/A'}
                              </TableCell>
                              <TableCell className="text-[#ADADB8]">
                                {table.last_vacuum ? new Date(table.last_vacuum).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-emerald-400 bg-emerald-400/10 border-emerald-400/30">
                                  Active
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8">
                                <Database className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                                <p className="text-[#ADADB8]">No table information available</p>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="performance" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Performance Metrics</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Database performance and query statistics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Activity className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">Performance Monitoring</h3>
                        <p className="text-[#ADADB8]">
                          Performance metrics will be displayed here when available.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="maintenance" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Database Maintenance</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Tools for database optimization and maintenance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          variant="outline"
                          className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] h-24 flex flex-col items-center justify-center"
                        >
                          <Zap className="h-6 w-6 mb-2" />
                          Analyze Tables
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] h-24 flex flex-col items-center justify-center"
                        >
                          <RefreshCw className="h-6 w-6 mb-2" />
                          Vacuum Database
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