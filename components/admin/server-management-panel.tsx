"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Server,
  Palette,
  Search,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { useToast } from '@/hooks/use-toast';
import { useRestartPredictions } from '@/hooks/use-restart-predictions';
import { RestartCountdown } from '@/components/restart-prediction-countdown';
import { RestartPredictionsTab } from '@/components/restart-predictions-tab';
import { cn } from '@/lib/utils';

interface StreamSearchConfig {
  id?: string;
  platform: 'twitch' | 'kick';
  search_keyword: string;
  search_type: 'title' | 'category' | 'tag';
  is_active: boolean;
  priority: number;
}

interface ServerManagementData {
  id: number;
  server_id: string;
  server_name: string;
  order: number | null;
  created_at: string;
  data_start_date: string | null;
  server_colors: {
    color_hsl: string;
  } | null;
  stream_search_config: StreamSearchConfig[];
}

interface EditingServer extends ServerManagementData {
  isEditing?: boolean;
}

export function ServerManagementPanel() {
  const [servers, setServers] = useState<ServerManagementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingServer, setEditingServer] = useState<EditingServer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newServerForm, setNewServerForm] = useState({
    server_id: '',
    server_name: '',
    data_start_date: new Date().toISOString().split('T')[0],
    color_hsl: '#9147ff',
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Get server IDs for restart predictions
  const serverIds = servers.map(s => s.server_id);
  const { getPrediction, refresh: refreshPredictions } = useRestartPredictions(
    serverIds,
    60000, // Auto-refresh every 60 seconds
    true   // Enabled
  );

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getServerManagementData();
      if (response.success && response.data) {
        setServers(response.data);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
      toast({
        title: "Error",
        description: "Failed to load server management data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleEditServer = (server: ServerManagementData) => {
    setEditingServer({
      ...server,
      isEditing: true,
    });
    setShowEditDialog(true);
  };

  const handleSaveServer = async () => {
    if (!editingServer) return;

    setIsSaving(true);
    try {
      await adminAPI.updateServerManagementData({
        server_id: editingServer.server_id,
        data_start_date: editingServer.data_start_date || undefined,
        server_colors: editingServer.server_colors || undefined,
        stream_search_config: editingServer.stream_search_config,
      });

      toast({
        title: "Success",
        description: "Server updated successfully.",
      });

      setShowEditDialog(false);
      setEditingServer(null);
      fetchServers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update server.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateServer = async () => {
    if (!newServerForm.server_id || !newServerForm.server_name) {
      toast({
        title: "Error",
        description: "Server ID and name are required.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create the server first
      await adminAPI.createServer({
        server_id: newServerForm.server_id,
        server_name: newServerForm.server_name,
        is_active: true,
        data_collection_enabled: true,
        display_order: servers.length + 1,
        tags: [],
      });

      // Then update the management data
      await adminAPI.updateServerManagementData({
        server_id: newServerForm.server_id,
        data_start_date: newServerForm.data_start_date,
        server_colors: {
          color_hsl: newServerForm.color_hsl,
        },
      });

      toast({
        title: "Success",
        description: "Server created successfully.",
      });

      setShowCreateDialog(false);
      setNewServerForm({
        server_id: '',
        server_name: '',
        data_start_date: new Date().toISOString().split('T')[0],
        color_hsl: '#9147ff',
      });
      fetchServers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create server.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    try {
      await adminAPI.deleteServer(deleteTarget);

      toast({
        title: "Success",
        description: "Server deleted successfully.",
      });

      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchServers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete server.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addStreamConfig = () => {
    if (!editingServer) return;
    const newConfig: StreamSearchConfig = {
      platform: 'twitch',
      search_keyword: '',
      search_type: 'title',
      is_active: true,
      priority: 1,
    };
    setEditingServer({
      ...editingServer,
      stream_search_config: [...editingServer.stream_search_config, newConfig],
    });
  };

  const removeStreamConfig = (index: number) => {
    if (!editingServer) return;
    setEditingServer({
      ...editingServer,
      stream_search_config: editingServer.stream_search_config.filter((_, i) => i !== index),
    });
  };

  const updateStreamConfig = (index: number, field: keyof StreamSearchConfig, value: any) => {
    if (!editingServer) return;
    const updated = [...editingServer.stream_search_config];
    updated[index] = { ...updated[index], [field]: value };
    setEditingServer({
      ...editingServer,
      stream_search_config: updated,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-[#9147ff] mr-2" />
        <span className="text-[#ADADB8]">Loading servers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Server Management</h2>
          <p className="text-[#ADADB8] text-sm">
            Manage server configuration, data collection dates, colors, and stream search settings
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#9147ff] hover:bg-[#772ce8] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Server
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Server</DialogTitle>
              <DialogDescription className="text-[#ADADB8]">
                Add a new server to the system
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-white">Server ID</Label>
                <Input
                  placeholder="e.g., gtarp-main"
                  value={newServerForm.server_id}
                  onChange={(e) => setNewServerForm(prev => ({ ...prev, server_id: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-white">Server Name</Label>
                <Input
                  placeholder="e.g., GTARP Main Server"
                  value={newServerForm.server_name}
                  onChange={(e) => setNewServerForm(prev => ({ ...prev, server_name: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-white">Data Start Date</Label>
                <Input
                  type="date"
                  value={newServerForm.data_start_date}
                  onChange={(e) => setNewServerForm(prev => ({ ...prev, data_start_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-white">Server Color</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="color"
                    value={newServerForm.color_hsl}
                    onChange={(e) => setNewServerForm(prev => ({ ...prev, color_hsl: e.target.value }))}
                    className="h-10 w-20 rounded cursor-pointer"
                  />
                  <span className="text-[#ADADB8]">{newServerForm.color_hsl}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleCreateServer}
                disabled={isSaving}
                className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Server
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Servers List */}
      {servers.length === 0 ? (
        <Card className="bg-[#1a1a1e] border-[#26262c]">
          <CardContent className="p-12 text-center">
            <Server className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Servers Configured</h3>
            <p className="text-[#ADADB8] mb-4">
              Create your first server to get started with data collection.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {servers.map((server) => (
            <Card key={server.server_id} className="bg-[#1a1a1e] border-[#26262c]">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: server.server_colors?.color_hsl || '#9147ff' }}
                      />
                      <h3 className="text-lg font-semibold text-white">{server.server_name}</h3>
                      <Badge variant="outline" className="text-[#ADADB8] border-[#40404a]">
                        {server.server_id}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Data Start Date</p>
                        <p className="text-white font-medium">
                          {server.data_start_date 
                            ? new Date(server.data_start_date).toLocaleDateString()
                            : 'Not set'
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-[#ADADB8]">Server Color</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <div
                            className="h-6 w-6 rounded border border-[#40404a]"
                            style={{ backgroundColor: server.server_colors?.color_hsl || '#9147ff' }}
                          />
                          <p className="text-white font-medium">
                            {server.server_colors?.color_hsl || '#9147ff'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-[#ADADB8]">Stream Configs</p>
                        <p className="text-white font-medium">
                          {server.stream_search_config.length} active
                        </p>
                      </div>

                      <div>
                        <RestartCountdown
                          nextRestartTime={getPrediction(server.server_id)?.nextRestartTime || null}
                          confidence={getPrediction(server.server_id)?.confidence || 0}
                          isStale={getPrediction(server.server_id)?.isStale}
                        />
                      </div>
                    </div>

                    {server.stream_search_config.length > 0 && (
                      <div className="mt-4 p-3 bg-[#26262c]/30 rounded border border-[#40404a]/30">
                        <p className="text-sm text-[#ADADB8] mb-2">Stream Search Keywords:</p>
                        <div className="flex flex-wrap gap-2">
                          {server.stream_search_config.map((config, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={cn(
                                "text-xs",
                                config.platform === 'twitch'
                                  ? 'border-purple-400/30 text-purple-400'
                                  : 'border-green-400/30 text-green-400'
                              )}
                            >
                              {config.platform}: {config.search_keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditServer(server)}
                      className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Dialog open={showEditDialog && editingServer?.server_id === server.server_id} onOpenChange={setShowEditDialog}>
                      <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Server: {editingServer?.server_name}</DialogTitle>
                          <DialogDescription className="text-[#ADADB8]">
                            Update server configuration, data collection date, colors, and stream search settings
                          </DialogDescription>
                        </DialogHeader>

                        {editingServer && (
                          <Tabs defaultValue="general" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 bg-[#26262c]">
                              <TabsTrigger value="general" className="text-white">General</TabsTrigger>
                              <TabsTrigger value="colors" className="text-white">Colors</TabsTrigger>
                              <TabsTrigger value="streams" className="text-white">Stream Config</TabsTrigger>
                              <TabsTrigger value="predictions" className="text-white">Restart Predictions</TabsTrigger>
                            </TabsList>

                            {/* General Tab */}
                            <TabsContent value="general" className="space-y-4 mt-4">
                              <div>
                                <Label className="text-white">Server ID</Label>
                                <Input
                                  disabled
                                  value={editingServer.server_id}
                                  className="bg-[#26262c] border-[#40404a] text-[#ADADB8] mt-2"
                                />
                              </div>

                              <div>
                                <Label className="text-white">Server Name</Label>
                                <Input
                                  value={editingServer.server_name}
                                  onChange={(e) => setEditingServer(prev => prev ? { ...prev, server_name: e.target.value } : null)}
                                  className="bg-[#26262c] border-[#40404a] text-white mt-2"
                                />
                              </div>

                              <div>
                                <Label className="text-white">Data Start Date</Label>
                                <Input
                                  type="date"
                                  value={editingServer.data_start_date ? editingServer.data_start_date.split('T')[0] : ''}
                                  onChange={(e) => setEditingServer(prev => prev ? { ...prev, data_start_date: e.target.value } : null)}
                                  className="bg-[#26262c] border-[#40404a] text-white mt-2"
                                />
                                <p className="text-xs text-[#ADADB8] mt-1">
                                  This date marks when data collection started for this server
                                </p>
                              </div>
                            </TabsContent>

                            {/* Colors Tab */}
                            <TabsContent value="colors" className="space-y-4 mt-4">
                              <div>
                                <Label className="text-white">Server Color (HSL)</Label>
                                <div className="flex items-center space-x-3 mt-2">
                                  <input
                                    type="color"
                                    value={editingServer.server_colors?.color_hsl || '#9147ff'}
                                    onChange={(e) => setEditingServer(prev => prev ? {
                                      ...prev,
                                      server_colors: { color_hsl: e.target.value }
                                    } : null)}
                                    className="h-12 w-20 rounded cursor-pointer"
                                  />
                                  <Input
                                    value={editingServer.server_colors?.color_hsl || '#9147ff'}
                                    onChange={(e) => setEditingServer(prev => prev ? {
                                      ...prev,
                                      server_colors: { color_hsl: e.target.value }
                                    } : null)}
                                    className="bg-[#26262c] border-[#40404a] text-white flex-1"
                                  />
                                </div>
                                <p className="text-xs text-[#ADADB8] mt-2">
                                  This color is used to identify the server in charts and dashboards
                                </p>
                              </div>
                            </TabsContent>

                            {/* Stream Config Tab */}
                            <TabsContent value="streams" className="space-y-4 mt-4">
                              <div className="space-y-4">
                                {editingServer.stream_search_config.map((config, idx) => (
                                  <div key={idx} className="p-4 bg-[#26262c]/30 rounded border border-[#40404a]/30">
                                    <div className="flex items-start justify-between mb-3">
                                      <h4 className="text-sm font-medium text-white">Config {idx + 1}</h4>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStreamConfig(idx)}
                                        className="text-red-400 hover:bg-red-400/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs text-[#ADADB8]">Platform</Label>
                                        <Select
                                          value={config.platform}
                                          onValueChange={(value) => updateStreamConfig(idx, 'platform', value as 'twitch' | 'kick')}
                                        >
                                          <SelectTrigger className="bg-[#1a1a1e] border-[#40404a] text-white mt-1">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="bg-[#26262c] border-[#40404a]">
                                            <SelectItem value="twitch">Twitch</SelectItem>
                                            <SelectItem value="kick">Kick</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <Label className="text-xs text-[#ADADB8]">Search Type</Label>
                                        <Select
                                          value={config.search_type}
                                          onValueChange={(value) => updateStreamConfig(idx, 'search_type', value as 'title' | 'category' | 'tag')}
                                        >
                                          <SelectTrigger className="bg-[#1a1a1e] border-[#40404a] text-white mt-1">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="bg-[#26262c] border-[#40404a]">
                                            <SelectItem value="title">Title</SelectItem>
                                            <SelectItem value="category">Category</SelectItem>
                                            <SelectItem value="tag">Tag</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="col-span-2">
                                        <Label className="text-xs text-[#ADADB8]">Search Keyword</Label>
                                        <Input
                                          value={config.search_keyword}
                                          onChange={(e) => updateStreamConfig(idx, 'search_keyword', e.target.value)}
                                          placeholder="e.g., GTA RP"
                                          className="bg-[#1a1a1e] border-[#40404a] text-white mt-1"
                                        />
                                      </div>

                                      <div>
                                        <Label className="text-xs text-[#ADADB8]">Priority</Label>
                                        <Input
                                          type="number"
                                          value={config.priority}
                                          onChange={(e) => updateStreamConfig(idx, 'priority', parseInt(e.target.value))}
                                          className="bg-[#1a1a1e] border-[#40404a] text-white mt-1"
                                        />
                                      </div>

                                      <div className="flex items-end">
                                        <div className="flex items-center space-x-2">
                                          <Checkbox
                                            checked={config.is_active}
                                            onCheckedChange={(checked) => updateStreamConfig(idx, 'is_active', checked)}
                                          />
                                          <Label className="text-xs text-[#ADADB8]">Active</Label>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                <Button
                                  variant="outline"
                                  onClick={addStreamConfig}
                                  className="w-full bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Stream Config
                                </Button>
                              </div>
                            </TabsContent>

                            {/* Restart Predictions Tab */}
                            <TabsContent value="predictions" className="space-y-4 mt-4">
                              <RestartPredictionsTab
                                prediction={getPrediction(editingServer.server_id)}
                                onRefresh={refreshPredictions}
                              />
                            </TabsContent>
                          </Tabs>
                        )}

                        <div className="flex justify-end space-x-3 pt-4 border-t border-[#26262c]">
                          <Button
                            variant="outline"
                            onClick={() => setShowEditDialog(false)}
                            className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
                          >
                            Cancel
                          </Button>
                          
                          <Button
                            onClick={handleSaveServer}
                            disabled={isSaving}
                            className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                          >
                            {isSaving ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget(server.server_id);
                        setShowDeleteDialog(true);
                      }}
                      className="bg-[#26262c] border-[#40404a] text-red-400 hover:bg-red-400/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog open={showDeleteDialog && deleteTarget === server.server_id} onOpenChange={setShowDeleteDialog}>
                      <AlertDialogContent className="bg-[#1a1a1e] border-[#26262c]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Delete Server</AlertDialogTitle>
                          <AlertDialogDescription className="text-[#ADADB8]">
                            Are you sure you want to delete <strong>{server.server_name}</strong>? This action cannot be undone and will delete all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteServer}
                            disabled={isSaving}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {isSaving ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete Server'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

