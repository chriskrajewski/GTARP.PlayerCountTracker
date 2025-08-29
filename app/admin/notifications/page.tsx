"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Bell, 
  Plus, 
  Search, 
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Users,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
  Settings,
  Send,
  Clock,
  Filter
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase-browser';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface NotificationBanner {
  id: number;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
  priority: number;
  is_dismissible: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  action_text?: string;
  action_url?: string;
  dismiss_count: number;
  view_count: number;
}

export default function AdminNotificationsPage() {
  const [banners, setBanners] = useState<NotificationBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [bannerDialog, setBannerDialog] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<NotificationBanner | null>(null);
  const [bannerForm, setBannerForm] = useState({
    title: '',
    message: '',
    type: 'info',
    is_active: true,
    priority: 1,
    is_dismissible: true,
    start_date: '',
    end_date: '',
    action_text: '',
    action_url: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient();
      
      const { data: banners, error } = await supabase
        .from('notification_banners')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading banners:', error);
        toast({
          title: "Error",
          description: "Failed to load notification banners.",
          variant: "destructive"
        });
      } else {
        setBanners(banners || []);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
      toast({
        title: "Error",
        description: "Failed to load notification banners.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBanner = async () => {
    try {
      const supabase = createBrowserClient();
      
      const insertData = {
        ...bannerForm,
        start_date: bannerForm.start_date || null,
        end_date: bannerForm.end_date || null,
        action_text: bannerForm.action_text || null,
        action_url: bannerForm.action_url || null,
      };
      
      const { data: newBanner, error } = await supabase
        .from('notification_banners')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating banner:', error);
        toast({
          title: "Error",
          description: "Failed to create notification banner.",
          variant: "destructive"
        });
        return;
      }
      
      setBanners(prev => [newBanner, ...prev]);
      setBannerDialog(false);
      resetBannerForm();
      toast({
        title: "Success",
        description: "Notification banner created successfully.",
      });
    } catch (error) {
      console.error('Error creating banner:', error);
      toast({
        title: "Error",
        description: "Failed to create notification banner.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateBanner = async () => {
    if (!selectedBanner) return;

    try {
      const supabase = createBrowserClient();
      
      const updateData = {
        ...bannerForm,
        start_date: bannerForm.start_date || null,
        end_date: bannerForm.end_date || null,
        action_text: bannerForm.action_text || null,
        action_url: bannerForm.action_url || null,
      };
      
      const { data: updatedBanner, error } = await supabase
        .from('notification_banners')
        .update(updateData)
        .eq('id', selectedBanner.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating banner:', error);
        toast({
          title: "Error",
          description: "Failed to update notification banner.",
          variant: "destructive"
        });
        return;
      }
      
      setBanners(prev => prev.map(b => b.id === selectedBanner.id ? updatedBanner : b));
      setBannerDialog(false);
      setSelectedBanner(null);
      resetBannerForm();
      toast({
        title: "Success",
        description: "Notification banner updated successfully.",
      });
    } catch (error) {
      console.error('Error updating banner:', error);
      toast({
        title: "Error",
        description: "Failed to update notification banner.",
        variant: "destructive"
      });
    }
  };

  const handleToggleBanner = async (bannerId: number, isActive: boolean) => {
    try {
      const supabase = createBrowserClient();
      
      const { error } = await supabase
        .from('notification_banners')
        .update({ is_active: isActive })
        .eq('id', bannerId);
      
      if (error) {
        console.error('Error toggling banner:', error);
        toast({
          title: "Error",
          description: "Failed to update banner status.",
          variant: "destructive"
        });
        return;
      }
      
      setBanners(prev => prev.map(b => 
        b.id === bannerId ? { ...b, is_active: isActive } : b
      ));
      toast({
        title: "Success",
        description: `Banner ${isActive ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      console.error('Error toggling banner:', error);
      toast({
        title: "Error",
        description: "Failed to update banner status.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteBanner = async (bannerId: number) => {
    try {
      const supabase = createBrowserClient();
      
      const { error } = await supabase
        .from('notification_banners')
        .delete()
        .eq('id', bannerId);
      
      if (error) {
        console.error('Error deleting banner:', error);
        toast({
          title: "Error",
          description: "Failed to delete notification banner.",
          variant: "destructive"
        });
        return;
      }
      
      setBanners(prev => prev.filter(b => b.id !== bannerId));
      toast({
        title: "Success",
        description: "Notification banner deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification banner.",
        variant: "destructive"
      });
    }
  };

  const resetBannerForm = () => {
    setBannerForm({
      title: '',
      message: '',
      type: 'info',
      is_active: true,
      priority: 1,
      is_dismissible: true,
      start_date: '',
      end_date: '',
      action_text: '',
      action_url: '',
    });
  };

  const openEditDialog = (banner: NotificationBanner) => {
    setSelectedBanner(banner);
    setBannerForm({
      title: banner.title,
      message: banner.message,
      type: banner.type,
      is_active: banner.is_active,
      priority: banner.priority,
      is_dismissible: banner.is_dismissible,
      start_date: banner.start_date || '',
      end_date: banner.end_date || '',
      action_text: banner.action_text || '',
      action_url: banner.action_url || '',
    });
    setBannerDialog(true);
  };

  const openCreateDialog = () => {
    setSelectedBanner(null);
    resetBannerForm();
    setBannerDialog(true);
  };

  const getBannerTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'warning': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'urgent': return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
      case 'announcement': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
    }
  };

  const getBannerTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'urgent': return <AlertTriangle className="h-4 w-4" />;
      case 'announcement': return <Bell className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const filteredBanners = banners.filter(banner => {
    const matchesSearch = searchQuery === '' || 
      banner.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      banner.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || banner.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && banner.is_active) ||
      (filterStatus === 'inactive' && !banner.is_active);

    return matchesSearch && matchesType && matchesStatus;
  });

  const activeBanners = banners.filter(b => b.is_active).length;
  const totalViews = banners.reduce((sum, b) => sum + b.view_count, 0);
  const totalDismissals = banners.reduce((sum, b) => sum + b.dismiss_count, 0);

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading notifications...</span>
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
                  <Bell className="mr-3 h-6 w-6" />
                  Notification Management
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Manage system notifications and announcement banners
                </p>
              </div>
              
              <Button 
                onClick={openCreateDialog}
                className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Banner
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ADADB8] h-4 w-4" />
                <Input
                  placeholder="Search banners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#26262c] border-[#40404a] text-white w-64"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48 bg-[#26262c] border-[#40404a] text-white">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent className="bg-[#26262c] border-[#40404a]">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 bg-[#26262c] border-[#40404a] text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-[#26262c] border-[#40404a]">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
                        <p className="text-sm text-[#ADADB8]">Total Banners</p>
                        <p className="text-2xl font-bold text-white">{banners.length}</p>
                      </div>
                      <Bell className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Active Banners</p>
                        <p className="text-2xl font-bold text-emerald-400">{activeBanners}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Views</p>
                        <p className="text-2xl font-bold text-blue-400">{totalViews.toLocaleString()}</p>
                      </div>
                      <Eye className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Dismissals</p>
                        <p className="text-2xl font-bold text-amber-400">{totalDismissals.toLocaleString()}</p>
                      </div>
                      <EyeOff className="h-8 w-8 text-amber-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Banners Table */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="text-white">Notification Banners</CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    Manage site-wide notification banners and announcements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredBanners.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No banners found</h3>
                      <p className="text-[#ADADB8] mb-4">
                        {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                          ? 'Try adjusting your search criteria or filters.'
                          : 'Create your first notification banner to get started.'
                        }
                      </p>
                      {(!searchQuery && filterType === 'all' && filterStatus === 'all') && (
                        <Button
                          onClick={openCreateDialog}
                          className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Banner
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#26262c]">
                          <TableHead className="text-[#ADADB8]">Banner</TableHead>
                          <TableHead className="text-[#ADADB8]">Type</TableHead>
                          <TableHead className="text-[#ADADB8]">Status</TableHead>
                          <TableHead className="text-[#ADADB8]">Priority</TableHead>
                          <TableHead className="text-[#ADADB8]">Views</TableHead>
                          <TableHead className="text-[#ADADB8]">Created</TableHead>
                          <TableHead className="text-[#ADADB8]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBanners.map((banner) => (
                          <TableRow key={banner.id} className="border-[#26262c] hover:bg-[#26262c]/50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-white">{banner.title}</div>
                                <div className="text-sm text-[#ADADB8] truncate max-w-xs">
                                  {banner.message}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("border", getBannerTypeColor(banner.type))}>
                                {getBannerTypeIcon(banner.type)}
                                <span className="ml-1 capitalize">{banner.type}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "border",
                                  banner.is_active 
                                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" 
                                    : "text-gray-400 bg-gray-400/10 border-gray-400/30"
                                )}
                              >
                                {banner.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white">{banner.priority}</TableCell>
                            <TableCell className="text-[#ADADB8]">{banner.view_count}</TableCell>
                            <TableCell className="text-[#ADADB8]">
                              {new Date(banner.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(banner)}
                                  className="text-[#ADADB8] hover:text-white hover:bg-[#333339]"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleBanner(banner.id, !banner.is_active)}
                                  className={cn(
                                    "hover:bg-[#333339]",
                                    banner.is_active 
                                      ? "text-amber-400 hover:text-amber-300" 
                                      : "text-emerald-400 hover:text-emerald-300"
                                  )}
                                >
                                  {banner.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-[#1a1a1e] border-[#26262c]">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-white">Delete Banner</AlertDialogTitle>
                                      <AlertDialogDescription className="text-[#ADADB8]">
                                        Are you sure you want to delete "{banner.title}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white">
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteBanner(banner.id)}
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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

      {/* Create/Edit Banner Dialog */}
      <Dialog open={bannerDialog} onOpenChange={setBannerDialog}>
        <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBanner ? 'Edit Banner' : 'Create Notification Banner'}
            </DialogTitle>
            <DialogDescription className="text-[#ADADB8]">
              {selectedBanner 
                ? 'Update the notification banner settings.' 
                : 'Create a new notification banner for users.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-white">Title *</Label>
                <Input
                  id="title"
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  placeholder="Banner title"
                />
              </div>
              
              <div>
                <Label htmlFor="type" className="text-white">Type</Label>
                <Select 
                  value={bannerForm.type} 
                  onValueChange={(value) => setBannerForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#26262c] border-[#40404a]">
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="message" className="text-white">Message *</Label>
              <Textarea
                id="message"
                value={bannerForm.message}
                onChange={(e) => setBannerForm(prev => ({ ...prev, message: e.target.value }))}
                className="bg-[#26262c] border-[#40404a] text-white"
                placeholder="Banner message"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority" className="text-white">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={bannerForm.priority}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  min="1"
                  max="10"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active" className="text-white">Active</Label>
                  <Switch
                    id="is_active"
                    checked={bannerForm.is_active}
                    onCheckedChange={(checked) => setBannerForm(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_dismissible" className="text-white">Dismissible</Label>
                  <Switch
                    id="is_dismissible"
                    checked={bannerForm.is_dismissible}
                    onCheckedChange={(checked) => setBannerForm(prev => ({ ...prev, is_dismissible: checked }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date" className="text-white">Start Date (Optional)</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={bannerForm.start_date}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="end_date" className="text-white">End Date (Optional)</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={bannerForm.end_date}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="action_text" className="text-white">Action Button Text (Optional)</Label>
                <Input
                  id="action_text"
                  value={bannerForm.action_text}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, action_text: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  placeholder="Learn More"
                />
              </div>
              
              <div>
                <Label htmlFor="action_url" className="text-white">Action URL (Optional)</Label>
                <Input
                  id="action_url"
                  value={bannerForm.action_url}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, action_url: e.target.value }))}
                  className="bg-[#26262c] border-[#40404a] text-white"
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setBannerDialog(false);
                setSelectedBanner(null);
                resetBannerForm();
              }}
              className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            >
              Cancel
            </Button>
            
            <Button
              onClick={selectedBanner ? handleUpdateBanner : handleCreateBanner}
              disabled={!bannerForm.title || !bannerForm.message}
              className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
            >
              {selectedBanner ? 'Update Banner' : 'Create Banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminProtected>
  );
}