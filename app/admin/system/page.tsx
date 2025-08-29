"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Settings, 
  Plus, 
  Search, 
  Edit3,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Key,
  Database,
  Globe,
  Shield,
  Zap,
  Clock,
  Save
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { SystemConfiguration, ConfigurationFormData } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminSystemPage() {
  const [configurations, setConfigurations] = useState<SystemConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [configDialog, setConfigDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SystemConfiguration | null>(null);
  const [formData, setFormData] = useState<ConfigurationFormData>({
    category: 'general',
    key: '',
    value: '',
    data_type: 'string',
    description: '',
    is_sensitive: false,
    requires_restart: false
  });
  const { toast } = useToast();

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getSystemConfigurations();
      if (response.success && response.data) {
        setConfigurations(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch configurations');
      }
    } catch (error) {
      console.error('Error fetching configurations:', error);
      toast({
        title: "Error",
        description: "Failed to load system configurations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const handleCreateConfig = async () => {
    try {
      const response = await adminAPI.createSystemConfiguration(formData);
      if (response.success && response.data) {
        setConfigurations(prev => [response.data, ...prev]);
        setConfigDialog(false);
        resetForm();
        toast({
          title: "Success",
          description: "Configuration created successfully.",
        });
      } else {
        throw new Error(response.error || 'Failed to create configuration');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create configuration",
        variant: "destructive"
      });
    }
  };

  const handleUpdateConfig = async () => {
    if (!selectedConfig) return;

    try {
      const response = await adminAPI.updateSystemConfiguration(selectedConfig.id, formData);
      if (response.success && response.data) {
        setConfigurations(prev => prev.map(c => c.id === selectedConfig.id ? response.data : c));
        setConfigDialog(false);
        setSelectedConfig(null);
        resetForm();
        toast({
          title: "Success",
          description: "Configuration updated successfully.",
        });
      } else {
        throw new Error(response.error || 'Failed to update configuration');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update configuration",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await adminAPI.deleteSystemConfiguration(configId);
      if (response.success) {
        setConfigurations(prev => prev.filter(c => c.id !== configId));
        toast({
          title: "Success",
          description: "Configuration deleted successfully.",
        });
      } else {
        throw new Error(response.error || 'Failed to delete configuration');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete configuration",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'general',
      key: '',
      value: '',
      data_type: 'string',
      description: '',
      is_sensitive: false,
      requires_restart: false
    });
  };

  const openEditDialog = (config: SystemConfiguration) => {
    setSelectedConfig(config);
    setFormData({
      category: config.category,
      key: config.key,
      value: config.value,
      data_type: config.data_type,
      description: config.description,
      is_sensitive: config.is_sensitive,
      requires_restart: config.requires_restart
    });
    setConfigDialog(true);
  };

  const openCreateDialog = () => {
    setSelectedConfig(null);
    resetForm();
    setConfigDialog(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'security': return <Shield className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'api': return <Globe className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'scheduling': return <Clock className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'security': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'database': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'api': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'performance': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'scheduling': return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
      default: return 'text-[#ADADB8] bg-[#ADADB8]/10 border-[#ADADB8]/30';
    }
  };

  const getDataTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'boolean': return 'text-emerald-400 bg-emerald-400/10';
      case 'number': return 'text-blue-400 bg-blue-400/10';
      case 'json': return 'text-purple-400 bg-purple-400/10';
      default: return 'text-[#ADADB8] bg-[#ADADB8]/10';
    }
  };

  const formatConfigValue = (config: SystemConfiguration) => {
    if (config.is_sensitive) {
      return '••••••••';
    }
    
    if (config.data_type === 'boolean') {
      return config.value === 'true' ? 'True' : 'False';
    }
    
    if (config.data_type === 'json') {
      try {
        const parsed = JSON.parse(config.value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return config.value;
      }
    }
    
    return config.value;
  };

  const filteredConfigurations = configurations.filter(config => {
    const matchesSearch = searchQuery === '' || 
      config.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || config.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(configurations.map(c => c.category)));
  const sensitiveCount = configurations.filter(c => c.is_sensitive).length;
  const restartRequiredCount = configurations.filter(c => c.requires_restart).length;

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading system configuration...</span>
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
                  <Settings className="mr-3 h-6 w-6" />
                  System Configuration
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Manage system settings and configuration parameters
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={fetchConfigurations}
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                
                <Button 
                  onClick={openCreateDialog}
                  className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ADADB8] h-4 w-4" />
                <Input
                  placeholder="Search configurations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#26262c] border-[#40404a] text-white w-64"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 bg-[#26262c] border-[#40404a] text-white">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent className="bg-[#26262c] border-[#40404a]">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        <p className="text-sm text-[#ADADB8]">Total Configs</p>
                        <p className="text-2xl font-bold text-white">{configurations.length}</p>
                      </div>
                      <Settings className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Categories</p>
                        <p className="text-2xl font-bold text-blue-400">{categories.length}</p>
                      </div>
                      <Database className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Sensitive</p>
                        <p className="text-2xl font-bold text-amber-400">{sensitiveCount}</p>
                      </div>
                      <Shield className="h-8 w-8 text-amber-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Restart Required</p>
                        <p className="text-2xl font-bold text-red-400">{restartRequiredCount}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Configuration Table */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="text-white">System Configurations</CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    Manage application settings and configuration parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredConfigurations.length === 0 ? (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No configurations found</h3>
                      <p className="text-[#ADADB8] mb-4">
                        {searchQuery || categoryFilter !== 'all'
                          ? 'Try adjusting your search criteria or filters.'
                          : 'Create your first configuration to get started.'
                        }
                      </p>
                      {(!searchQuery && categoryFilter === 'all') && (
                        <Button
                          onClick={openCreateDialog}
                          className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Configuration
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#26262c]">
                          <TableHead className="text-[#ADADB8]">Configuration</TableHead>
                          <TableHead className="text-[#ADADB8]">Category</TableHead>
                          <TableHead className="text-[#ADADB8]">Type</TableHead>
                          <TableHead className="text-[#ADADB8]">Value</TableHead>
                          <TableHead className="text-[#ADADB8]">Flags</TableHead>
                          <TableHead className="text-[#ADADB8]">Updated</TableHead>
                          <TableHead className="text-[#ADADB8]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredConfigurations.map((config) => (
                          <TableRow key={config.id} className="border-[#26262c] hover:bg-[#26262c]/50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-white">{config.key}</div>
                                <div className="text-sm text-[#ADADB8] max-w-xs truncate">
                                  {config.description}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("border", getCategoryColor(config.category))}>
                                {getCategoryIcon(config.category)}
                                <span className="ml-1 capitalize">{config.category}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={getDataTypeColor(config.data_type)}>
                                {config.data_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs font-mono text-sm">
                                {config.data_type === 'json' ? (
                                  <pre className="text-[#ADADB8] truncate whitespace-pre-wrap">
                                    {formatConfigValue(config)}
                                  </pre>
                                ) : (
                                  <span className="text-white truncate">
                                    {formatConfigValue(config)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                {config.is_sensitive && (
                                  <Badge variant="outline" className="text-amber-400 bg-amber-400/10 border-amber-400/30">
                                    <Key className="h-3 w-3 mr-1" />
                                    Sensitive
                                  </Badge>
                                )}
                                {config.requires_restart && (
                                  <Badge variant="outline" className="text-red-400 bg-red-400/10 border-red-400/30">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Restart
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-[#ADADB8] text-sm">
                              {new Date(config.updated_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(config)}
                                  className="text-[#ADADB8] hover:text-white hover:bg-[#333339]"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteConfig(config.id)}
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

      {/* Create/Edit Configuration Dialog */}
      <Dialog open={configDialog} onOpenChange={setConfigDialog}>
        <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig ? 'Edit Configuration' : 'Create Configuration'}
            </DialogTitle>
            <DialogDescription className="text-[#ADADB8]">
              {selectedConfig 
                ? 'Update the system configuration parameter.' 
                : 'Create a new system configuration parameter.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-white">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#26262c] border-[#40404a]">
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="scheduling">Scheduling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="data_type" className="text-white">Data Type</Label>
                <Select 
                  value={formData.data_type} 
                  onValueChange={(value: 'string' | 'number' | 'boolean' | 'json') => setFormData(prev => ({ ...prev, data_type: value }))}
                >
                  <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#26262c] border-[#40404a]">
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="key" className="text-white">Configuration Key *</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                className="bg-[#26262c] border-[#40404a] text-white"
                placeholder="e.g., api_rate_limit"
                disabled={!!selectedConfig}
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-white">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-[#26262c] border-[#40404a] text-white"
                placeholder="Brief description of this configuration"
              />
            </div>

            <div>
              <Label htmlFor="value" className="text-white">Value *</Label>
              {formData.data_type === 'json' ? (
                <Textarea
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white font-mono"
                  placeholder='{"key": "value"}'
                  rows={4}
                />
              ) : formData.data_type === 'boolean' ? (
                <Select 
                  value={formData.value} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, value: value }))}
                >
                  <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#26262c] border-[#40404a]">
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="value"
                  type={formData.data_type === 'number' ? 'number' : 'text'}
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  placeholder={
                    formData.data_type === 'number' 
                      ? '100' 
                      : 'Configuration value'
                  }
                />
              )}
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_sensitive"
                  checked={formData.is_sensitive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_sensitive: checked }))}
                />
                <Label htmlFor="is_sensitive" className="text-white flex items-center">
                  <Key className="h-4 w-4 mr-1" />
                  Sensitive
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="requires_restart"
                  checked={formData.requires_restart}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requires_restart: checked }))}
                />
                <Label htmlFor="requires_restart" className="text-white flex items-center">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Requires Restart
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setConfigDialog(false);
                setSelectedConfig(null);
                resetForm();
              }}
              className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              Cancel
            </Button>
            
            <Button
              onClick={selectedConfig ? handleUpdateConfig : handleCreateConfig}
              disabled={!formData.key || !formData.value || !formData.description}
              className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {selectedConfig ? 'Update Configuration' : 'Create Configuration'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminProtected>
  );
}