"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Server, 
  Eye, 
  EyeOff, 
  Search, 
  Settings,
  Activity,
  Database,
  MoreVertical,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { ServerConfiguration, ServerFormData, PaginatedResponse } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminServersPage() {
  const [servers, setServers] = useState<ServerConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ServerConfiguration | null>(null);
  const [deleteServerId, setDeleteServerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServerFormData>({
    server_name: '',
    server_id: '',
    is_active: true,
    data_collection_enabled: true,
    display_order: 1,
    api_endpoint: '',
    description: '',
    category: '',
    tags: [],
    owner: '',
    contact_info: '',
    color_primary: '#9147ff',
    color_secondary: '#772ce8',
    color_accent: '#5a1fb8',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'order' | 'created'>('order');
  const [sortDesc, setSortDesc] = useState(false);
  
  const { toast } = useToast();

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getServers({
        page: currentPage,
        limit: 20,
        search: searchQuery || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      
      if (response.success && response.data) {
        setServers(response.data.items);
        setTotalPages(Math.ceil(response.data.total / response.data.limit));
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
      toast({
        title: "Error",
        description: "Failed to load servers. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, [currentPage, searchQuery, statusFilter]);

  const resetForm = () => {
    setFormData({
      server_name: '',
      server_id: '',
      is_active: true,
      data_collection_enabled: true,
      display_order: Math.max(...servers.map(s => s.display_order), 0) + 1,
      api_endpoint: '',
      description: '',
      category: '',
      tags: [],
      owner: '',
      contact_info: '',
      color_primary: '#9147ff',
      color_secondary: '#772ce8',
      color_accent: '#5a1fb8',
    });
  };

  const handleCreate = async () => {
    try {
      const response = await adminAPI.createServer(formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Server created successfully.",
        });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchServers();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create server.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedServer) return;
    
    try {
      const response = await adminAPI.updateServer(selectedServer.server_id, formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Server updated successfully.",
        });
        setIsEditDialogOpen(false);
        setSelectedServer(null);
        resetForm();
        fetchServers();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update server.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteServerId) return;
    
    try {
      const response = await adminAPI.deleteServer(deleteServerId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Server deleted successfully.",
        });
        setDeleteServerId(null);
        fetchServers();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete server.",
        variant: "destructive"
      });
    }
  };

  const handleToggleStatus = async (serverId: string, isActive: boolean) => {
    try {
      const response = await adminAPI.toggleServerStatus(serverId, isActive);
      if (response.success) {
        toast({
          title: "Success",
          description: `Server ${isActive ? 'activated' : 'deactivated'} successfully.`,
        });
        fetchServers();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update server status.",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (server: ServerConfiguration) => {
    setSelectedServer(server);
    setFormData({
      server_name: server.server_name,
      server_id: server.server_id,
      is_active: server.is_active,
      data_collection_enabled: server.data_collection_enabled,
      display_order: server.display_order,
      api_endpoint: server.api_endpoint || '',
      description: server.metadata.description || '',
      category: server.metadata.category || '',
      tags: server.metadata.tags || [],
      owner: server.metadata.owner || '',
      contact_info: server.metadata.contact_info || '',
      color_primary: server.color_scheme?.primary || '#9147ff',
      color_secondary: server.color_scheme?.secondary || '#772ce8',
      color_accent: server.color_scheme?.accent || '#5a1fb8',
    });
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, tags }));
  };

  const getStatusIcon = (server: ServerConfiguration) => {
    if (!server.is_active) return <XCircle className="h-4 w-4 text-red-400" />;
    if (!server.data_collection_enabled) return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  };

  const getStatusText = (server: ServerConfiguration) => {
    if (!server.is_active) return 'Inactive';
    if (!server.data_collection_enabled) return 'Data Disabled';
    return 'Active';
  };

  const getStatusColor = (server: ServerConfiguration) => {
    if (!server.is_active) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (!server.data_collection_enabled) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  };

  const filteredServers = servers.filter(server => {
    const matchesSearch = server.server_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.server_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && server.is_active) ||
                         (statusFilter === 'inactive' && !server.is_active);
    return matchesSearch && matchesStatus;
  });

  const sortedServers = [...filteredServers].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'name':
        compareValue = a.server_name.localeCompare(b.server_name);
        break;
      case 'id':
        compareValue = a.server_id.localeCompare(b.server_id);
        break;
      case 'order':
        compareValue = a.display_order - b.display_order;
        break;
      case 'created':
        compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    
    return sortDesc ? -compareValue : compareValue;
  });

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10]">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Server Management</h1>
                <p className="text-[#ADADB8] text-sm">
                  Manage server configurations, monitoring, and data collection
                </p>
              </div>
              
              <Button 
                onClick={openCreateDialog}
                className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ADADB8] h-4 w-4" />
                <Input
                  placeholder="Search servers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#26262c] border-[#40404a] text-white placeholder-[#ADADB8]"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-[#26262c] border-[#40404a] text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-[#26262c] border-[#40404a]">
                  <SelectItem value="all">All Servers</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[150px] bg-[#26262c] border-[#40404a] text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-[#26262c] border-[#40404a]">
                  <SelectItem value="order">Display Order</SelectItem>
                  <SelectItem value="name">Server Name</SelectItem>
                  <SelectItem value="id">Server ID</SelectItem>
                  <SelectItem value="created">Created Date</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDesc(!sortDesc)}
                className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              
              {/* Server Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Servers</p>
                        <p className="text-2xl font-bold text-white">{servers.length}</p>
                      </div>
                      <Server className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Active Servers</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {servers.filter(s => s.is_active).length}
                        </p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Data Collection</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {servers.filter(s => s.data_collection_enabled).length}
                        </p>
                      </div>
                      <Database className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Inactive</p>
                        <p className="text-2xl font-bold text-red-400">
                          {servers.filter(s => !s.is_active).length}
                        </p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Servers Table */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="text-white">Servers</CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    Manage your server configurations and monitoring settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-[#ADADB8]">Loading servers...</div>
                    </div>
                  ) : sortedServers.length === 0 ? (
                    <div className="text-center py-8">
                      <Server className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No servers found</h3>
                      <p className="text-[#ADADB8] mb-4">
                        {searchQuery ? 'Try adjusting your search criteria.' : 'Get started by adding your first server.'}
                      </p>
                      {!searchQuery && (
                        <Button 
                          onClick={openCreateDialog}
                          className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Server
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#26262c] hover:bg-[#26262c]">
                            <TableHead className="text-[#ADADB8]">Server</TableHead>
                            <TableHead className="text-[#ADADB8]">Status</TableHead>
                            <TableHead className="text-[#ADADB8]">Category</TableHead>
                            <TableHead className="text-[#ADADB8]">Order</TableHead>
                            <TableHead className="text-[#ADADB8]">Created</TableHead>
                            <TableHead className="text-[#ADADB8]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedServers.map((server) => (
                            <TableRow key={server.server_id} className="border-[#26262c] hover:bg-[#26262c]/50">
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: server.color_scheme?.primary || '#9147ff' }}
                                  />
                                  <div>
                                    <div className="font-medium text-white">{server.server_name}</div>
                                    <div className="text-sm text-[#ADADB8]">ID: {server.server_id}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("border", getStatusColor(server))}>
                                  {getStatusIcon(server)}
                                  <span className="ml-1">{getStatusText(server)}</span>
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-white">
                                  {server.metadata.category || 'Uncategorized'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-white">{server.display_order}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-[#ADADB8]">
                                  {new Date(server.created_at).toLocaleDateString()}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(server)}
                                    className="text-[#ADADB8] hover:text-white hover:bg-[#333339]"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(server.server_id, !server.is_active)}
                                    className={cn(
                                      "hover:bg-[#333339]",
                                      server.is_active 
                                        ? "text-amber-400 hover:text-amber-300" 
                                        : "text-emerald-400 hover:text-emerald-300"
                                    )}
                                  >
                                    {server.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                  
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteServerId(server.server_id)}
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Server Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedServer(null);
          resetForm();
        }
      }}>
        <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateDialogOpen ? 'Create New Server' : 'Edit Server'}
            </DialogTitle>
            <DialogDescription className="text-[#ADADB8]">
              {isCreateDialogOpen 
                ? 'Configure a new server for monitoring and data collection.' 
                : 'Update server configuration and settings.'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
              <TabsTrigger value="basic" className="text-white">Basic Info</TabsTrigger>
              <TabsTrigger value="config" className="text-white">Configuration</TabsTrigger>
              <TabsTrigger value="metadata" className="text-white">Metadata</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="server_name" className="text-white">Server Name *</Label>
                  <Input
                    id="server_name"
                    value={formData.server_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, server_name: e.target.value }))}
                    className="bg-[#26262c] border-[#40404a] text-white"
                    placeholder="My GTA RP Server"
                  />
                </div>
                
                <div>
                  <Label htmlFor="server_id" className="text-white">Server ID *</Label>
                  <Input
                    id="server_id"
                    value={formData.server_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, server_id: e.target.value }))}
                    className="bg-[#26262c] border-[#40404a] text-white"
                    placeholder="o3re8y"
                    disabled={isEditDialogOpen}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-[#26262c] rounded-lg">
                  <div>
                    <Label className="text-white">Active Server</Label>
                    <p className="text-sm text-[#ADADB8]">Enable this server for monitoring</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-[#26262c] rounded-lg">
                  <div>
                    <Label className="text-white">Data Collection</Label>
                    <p className="text-sm text-[#ADADB8]">Collect player count data</p>
                  </div>
                  <Switch
                    checked={formData.data_collection_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, data_collection_enabled: checked }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="display_order" className="text-white">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 1 }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  min="1"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="config" className="space-y-4">
              <div>
                <Label htmlFor="api_endpoint" className="text-white">Custom API Endpoint</Label>
                <Input
                  id="api_endpoint"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_endpoint: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  placeholder="https://servers-frontend.fivem.net/api/servers/single/..."
                />
              </div>

              <div>
                <Label className="text-white">Color Scheme</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label htmlFor="color_primary" className="text-sm text-[#ADADB8]">Primary</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="color_primary"
                        type="color"
                        value={formData.color_primary}
                        onChange={(e) => setFormData(prev => ({ ...prev, color_primary: e.target.value }))}
                        className="w-12 h-8 p-1 bg-[#26262c] border-[#40404a]"
                      />
                      <Input
                        value={formData.color_primary}
                        onChange={(e) => setFormData(prev => ({ ...prev, color_primary: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="color_secondary" className="text-sm text-[#ADADB8]">Secondary</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="color_secondary"
                        type="color"
                        value={formData.color_secondary}
                        onChange={(e) => setFormData(prev => ({ ...prev, color_secondary: e.target.value }))}
                        className="w-12 h-8 p-1 bg-[#26262c] border-[#40404a]"
                      />
                      <Input
                        value={formData.color_secondary}
                        onChange={(e) => setFormData(prev => ({ ...prev, color_secondary: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="color_accent" className="text-sm text-[#ADADB8]">Accent</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="color_accent"
                        type="color"
                        value={formData.color_accent}
                        onChange={(e) => setFormData(prev => ({ ...prev, color_accent: e.target.value }))}
                        className="w-12 h-8 p-1 bg-[#26262c] border-[#40404a]"
                      />
                      <Input
                        value={formData.color_accent}
                        onChange={(e) => setFormData(prev => ({ ...prev, color_accent: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="metadata" className="space-y-4">
              <div>
                <Label htmlFor="description" className="text-white">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  placeholder="Brief description of the server..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category" className="text-white">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="bg-[#26262c] border-[#40404a] text-white"
                    placeholder="e.g., Roleplay, Racing, PvP"
                  />
                </div>

                <div>
                  <Label htmlFor="tags" className="text-white">Tags</Label>
                  <Input
                    id="tags"
                    value={formData.tags.join(', ')}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    className="bg-[#26262c] border-[#40404a] text-white"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="owner" className="text-white">Owner</Label>
                  <Input
                    id="owner"
                    value={formData.owner}
                    onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                    className="bg-[#26262c] border-[#40404a] text-white"
                    placeholder="Server owner/administrator"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_info" className="text-white">Contact Info</Label>
                  <Input
                    id="contact_info"
                    value={formData.contact_info}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_info: e.target.value }))}
                    className="bg-[#26262c] border-[#40404a] text-white"
                    placeholder="Discord, email, etc."
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#26262c]">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedServer(null);
                resetForm();
              }}
              className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              Cancel
            </Button>
            
            <Button
              onClick={isCreateDialogOpen ? handleCreate : handleEdit}
              disabled={!formData.server_name || !formData.server_id}
              className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
            >
              {isCreateDialogOpen ? 'Create Server' : 'Update Server'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteServerId} onOpenChange={() => setDeleteServerId(null)}>
        <AlertDialogContent className="bg-[#1a1a1e] border-[#26262c]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Server</AlertDialogTitle>
            <AlertDialogDescription className="text-[#ADADB8]">
              Are you sure you want to delete this server? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminProtected>
  );
}