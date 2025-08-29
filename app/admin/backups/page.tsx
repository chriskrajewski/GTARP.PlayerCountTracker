"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  HardDrive, 
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Archive,
  Database
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { DatabaseBackup } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const { toast } = useToast();

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDatabaseBackups();
      if (response.success && response.data) {
        setBackups(response.data);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast({
        title: "Error",
        description: "Failed to load backup information.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setBackupInProgress(true);
      const response = await adminAPI.createDatabaseBackup();
      if (response.success) {
        toast({
          title: "Success",
          description: "Database backup initiated successfully.",
        });
        fetchBackups();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create database backup.",
        variant: "destructive"
      });
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await adminAPI.deleteBackup(backupId);
      if (response.success) {
        setBackups(prev => prev.filter(b => b.id !== backupId));
        toast({
          title: "Success",
          description: "Backup deleted successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete backup.",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'in_progress': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-[#ADADB8] bg-[#ADADB8]/10 border-[#ADADB8]/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Archive className="h-4 w-4" />;
    }
  };

  const completedBackups = backups.filter(b => b.status === 'completed').length;
  const failedBackups = backups.filter(b => b.status === 'failed').length;
  const totalSize = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading backup information...</span>
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
                  <HardDrive className="mr-3 h-6 w-6" />
                  Database Backups
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Manage database backups and data recovery
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={fetchBackups}
                  variant="outline"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                
                <Button 
                  onClick={handleCreateBackup}
                  disabled={backupInProgress}
                  className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                >
                  {backupInProgress ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Backup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Backups</p>
                        <p className="text-2xl font-bold text-white">{backups.length}</p>
                      </div>
                      <Archive className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Completed</p>
                        <p className="text-2xl font-bold text-emerald-400">{completedBackups}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Failed</p>
                        <p className="text-2xl font-bold text-red-400">{failedBackups}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Size</p>
                        <p className="text-2xl font-bold text-blue-400">{formatFileSize(totalSize)}</p>
                      </div>
                      <Database className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Backups Table */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="text-white">Backup History</CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    View and manage database backup files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {backups.length === 0 ? (
                    <div className="text-center py-8">
                      <HardDrive className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No backups found</h3>
                      <p className="text-[#ADADB8] mb-4">
                        Create your first backup to ensure data safety.
                      </p>
                      <Button
                        onClick={handleCreateBackup}
                        disabled={backupInProgress}
                        className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Backup
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#26262c]">
                          <TableHead className="text-[#ADADB8]">Backup</TableHead>
                          <TableHead className="text-[#ADADB8]">Status</TableHead>
                          <TableHead className="text-[#ADADB8]">Size</TableHead>
                          <TableHead className="text-[#ADADB8]">Type</TableHead>
                          <TableHead className="text-[#ADADB8]">Created</TableHead>
                          <TableHead className="text-[#ADADB8]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backups.map((backup) => (
                          <TableRow key={backup.id} className="border-[#26262c] hover:bg-[#26262c]/50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-white">{backup.name}</div>
                                <div className="text-sm text-[#ADADB8]">
                                  ID: {backup.id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("border", getStatusColor(backup.status))}>
                                {getStatusIcon(backup.status)}
                                <span className="ml-1 capitalize">{backup.status}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[#ADADB8]">
                              {backup.size_bytes ? formatFileSize(backup.size_bytes) : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-blue-400 bg-blue-400/10">
                                {backup.backup_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[#ADADB8] text-sm">
                              {new Date(backup.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {backup.status === 'completed' && backup.download_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(backup.download_url, '_blank')}
                                    className="text-[#ADADB8] hover:text-white hover:bg-[#333339]"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteBackup(backup.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}