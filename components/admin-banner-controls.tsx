"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, Users, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NotificationBanner } from '@/components/notification-banner';
import { Database } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/lib/admin-auth';

// Type definitions
type NotificationBanner = Database['public']['Tables']['notification_banners']['Row'];
type NotificationBannerInsert = Database['public']['Tables']['notification_banners']['Insert'];

interface BannerFormData {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'announcement' | 'urgent';
  priority: number;
  is_active: boolean;
  is_dismissible: boolean;
  start_date: string;
  end_date: string;
  action_text: string;
  action_url: string;
  action_target: '_self' | '_blank';
  background_color: string;
  text_color: string;
  border_color: string;
}

const DEFAULT_FORM_DATA: BannerFormData = {
  title: '',
  message: '',
  type: 'info',
  priority: 1,
  is_active: true,
  is_dismissible: true,
  start_date: '',
  end_date: '',
  action_text: '',
  action_url: '',
  action_target: '_self',
  background_color: '',
  text_color: '',
  border_color: '',
};

const BANNER_TYPE_OPTIONS = [
  { value: 'info', label: 'Info', color: '#1e40af' },
  { value: 'warning', label: 'Warning', color: '#d97706' },
  { value: 'success', label: 'Success', color: '#059669' },
  { value: 'announcement', label: 'Announcement', color: '#7c3aed' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' },
];

export function AdminBannerControls() {
  const [banners, setBanners] = useState<NotificationBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<BannerFormData>(DEFAULT_FORM_DATA);
  const [editingBanner, setEditingBanner] = useState<NotificationBanner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const { token } = useAdminAuth();

  // Fetch banners
  const fetchBanners = async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/notification-banners?include_inactive=true', {
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch banners');
      }

      const data = await response.json();
      setBanners(data.banners || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast({
        title: "Error",
        description: "Failed to fetch banners",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchBanners();
    }
  }, [token]);

  // Form handlers
  const handleInputChange = (field: keyof BannerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData: Partial<NotificationBannerInsert> = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        priority: formData.priority,
        is_active: formData.is_active,
        is_dismissible: formData.is_dismissible,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        action_text: formData.action_text || null,
        action_url: formData.action_url || null,
        action_target: formData.action_target || null,
        background_color: formData.background_color || null,
        text_color: formData.text_color || null,
        border_color: formData.border_color || null,
      };

      const isEditing = editingBanner !== null;
      const url = isEditing 
        ? `/api/notification-banners?id=${editingBanner.id}`
        : '/api/notification-banners';
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save banner');
      }

      toast({
        title: "Success",
        description: `Banner ${isEditing ? 'updated' : 'created'} successfully`,
      });

      setShowForm(false);
      setEditingBanner(null);
      setFormData(DEFAULT_FORM_DATA);
      await fetchBanners();

    } catch (error) {
      console.error('Error saving banner:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save banner',
        variant: "destructive",
      });
    }
  };

  const handleEdit = (banner: NotificationBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      message: banner.message,
      type: banner.type,
      priority: banner.priority,
      is_active: banner.is_active,
      is_dismissible: banner.is_dismissible,
      start_date: banner.start_date ? banner.start_date.substring(0, 16) : '',
      end_date: banner.end_date ? banner.end_date.substring(0, 16) : '',
      action_text: banner.action_text || '',
      action_url: banner.action_url || '',
      action_target: banner.action_target || '_self',
      background_color: banner.background_color || '',
      text_color: banner.text_color || '',
      border_color: banner.border_color || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (bannerId: number) => {
    if (!confirm('Are you sure you want to delete this banner?')) {
      return;
    }

    try {
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/notification-banners?id=${bannerId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to delete banner');
      }

      toast({
        title: "Success",
        description: "Banner deleted successfully",
      });

      await fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast({
        title: "Error",
        description: "Failed to delete banner",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (banner: NotificationBanner) => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/notification-banners?id=${banner.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_active: !banner.is_active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update banner');
      }

      await fetchBanners();
    } catch (error) {
      console.error('Error updating banner:', error);
      toast({
        title: "Error",
        description: "Failed to update banner",
        variant: "destructive",
      });
    }
  };

  const createPreviewBanner = (): NotificationBanner => ({
    id: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    title: formData.title || 'Preview Title',
    message: formData.message || 'This is a preview of your notification banner.',
    type: formData.type,
    priority: formData.priority,
    is_active: formData.is_active,
    is_dismissible: formData.is_dismissible,
    start_date: formData.start_date || null,
    end_date: formData.end_date || null,
    action_text: formData.action_text || null,
    action_url: formData.action_url || null,
    action_target: formData.action_target || null,
    background_color: formData.background_color || null,
    text_color: formData.text_color || null,
    border_color: formData.border_color || null,
    created_by: null,
    view_count: 0,
    dismiss_count: 0,
  });

  if (loading) {
    return (
      <Card className="w-full bg-[#0e0e10] border-[#26262c]">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading banners...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <Card className="bg-[#0e0e10] border-[#26262c]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Notification Banner Management</CardTitle>
              <CardDescription className="text-[#ADADB8]">
                Create and manage notification banners for your site
              </CardDescription>
            </div>
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingBanner(null);
                    setFormData(DEFAULT_FORM_DATA);
                  }}
                  className="bg-[#004D61] hover:bg-[#003a4d] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Banner
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0e0e10] border-[#26262c] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingBanner ? 'Edit Banner' : 'Create New Banner'}
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-white">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Banner title"
                        required
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-white">Message</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        placeholder="Banner message"
                        required
                        rows={3}
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type" className="text-white">Type</Label>
                        <Select value={formData.type} onValueChange={(value: any) => handleInputChange('type', value)}>
                          <SelectTrigger className="bg-[#18181b] border-[#26262c] text-white">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#18181b] border-[#26262c]">
                            {BANNER_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-white hover:bg-[#26262c]">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: option.color }}
                                  />
                                  {option.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="priority" className="text-white">Priority (1-10)</Label>
                        <Input
                          id="priority"
                          type="number"
                          min="1"
                          max="10"
                          value={formData.priority}
                          onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                        />
                        <Label htmlFor="is_active" className="text-white">Active</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_dismissible"
                          checked={formData.is_dismissible}
                          onCheckedChange={(checked) => handleInputChange('is_dismissible', checked)}
                        />
                        <Label htmlFor="is_dismissible" className="text-white">Dismissible</Label>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-[#26262c]" />

                  {/* Scheduling */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white">Scheduling (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date" className="text-white">Start Date</Label>
                        <Input
                          id="start_date"
                          type="datetime-local"
                          value={formData.start_date}
                          onChange={(e) => handleInputChange('start_date', e.target.value)}
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>

                      <div>
                        <Label htmlFor="end_date" className="text-white">End Date</Label>
                        <Input
                          id="end_date"
                          type="datetime-local"
                          value={formData.end_date}
                          onChange={(e) => handleInputChange('end_date', e.target.value)}
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-[#26262c]" />

                  {/* Action Button */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white">Action Button (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="action_text" className="text-white">Button Text</Label>
                        <Input
                          id="action_text"
                          value={formData.action_text}
                          onChange={(e) => handleInputChange('action_text', e.target.value)}
                          placeholder="Learn More"
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>

                      <div>
                        <Label htmlFor="action_url" className="text-white">Button URL</Label>
                        <Input
                          id="action_url"
                          type="url"
                          value={formData.action_url}
                          onChange={(e) => handleInputChange('action_url', e.target.value)}
                          placeholder="https://example.com"
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>
                    </div>

                    {formData.action_url && (
                      <div>
                        <Label htmlFor="action_target" className="text-white">Link Target</Label>
                        <Select 
                          value={formData.action_target} 
                          onValueChange={(value: any) => handleInputChange('action_target', value)}
                        >
                          <SelectTrigger className="bg-[#18181b] border-[#26262c] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#18181b] border-[#26262c]">
                            <SelectItem value="_self" className="text-white hover:bg-[#26262c]">Same Tab</SelectItem>
                            <SelectItem value="_blank" className="text-white hover:bg-[#26262c]">New Tab</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-[#26262c]" />

                  {/* Custom Colors */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white">Custom Colors (Optional)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="background_color" className="text-white">Background</Label>
                        <Input
                          id="background_color"
                          type="color"
                          value={formData.background_color}
                          onChange={(e) => handleInputChange('background_color', e.target.value)}
                          className="bg-[#18181b] border-[#26262c] h-10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="text_color" className="text-white">Text</Label>
                        <Input
                          id="text_color"
                          type="color"
                          value={formData.text_color}
                          onChange={(e) => handleInputChange('text_color', e.target.value)}
                          className="bg-[#18181b] border-[#26262c] h-10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="border_color" className="text-white">Border</Label>
                        <Input
                          id="border_color"
                          type="color"
                          value={formData.border_color}
                          onChange={(e) => handleInputChange('border_color', e.target.value)}
                          className="bg-[#18181b] border-[#26262c] h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {(formData.title || formData.message) && (
                    <>
                      <Separator className="bg-[#26262c]" />
                      <div className="space-y-2">
                        <Label className="text-white">Preview</Label>
                        <div className="border border-[#26262c] rounded-md p-4 bg-black">
                          <NotificationBanner
                            banner={createPreviewBanner()}
                            onDismiss={() => {}} // No-op for preview
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      className="bg-[#004D61] hover:bg-[#003a4d] text-white flex-1"
                    >
                      {editingBanner ? 'Update Banner' : 'Create Banner'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Banner List */}
      <Card className="bg-[#0e0e10] border-[#26262c]">
        <CardContent className="p-6">
          {banners.length === 0 ? (
            <div className="text-center py-8 text-[#ADADB8]">
              No banners found. Create your first banner to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="flex items-center justify-between p-4 bg-[#18181b] rounded-lg border border-[#26262c]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-white truncate">{banner.title}</h3>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          banner.is_active 
                            ? "border-green-600 text-green-400" 
                            : "border-gray-600 text-gray-400"
                        )}
                      >
                        {banner.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-[#26262c] text-[#ADADB8]">
                        {banner.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-[#26262c] text-[#ADADB8]">
                        Priority: {banner.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-[#ADADB8] truncate mb-2">{banner.message}</p>
                    <div className="flex items-center gap-4 text-xs text-[#ADADB8]">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {banner.view_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {banner.dismiss_count} dismissals
                      </span>
                      {banner.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Starts: {new Date(banner.start_date).toLocaleDateString()}
                        </span>
                      )}
                      {banner.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Ends: {new Date(banner.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(banner)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      {banner.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(banner)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(banner.id)}
                      className="border-red-600 text-red-400 hover:bg-red-600/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
