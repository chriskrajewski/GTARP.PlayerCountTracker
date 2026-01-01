"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar } from 'lucide-react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/lib/admin-auth';
import MDEditor from '@uiw/react-md-editor';
import type { Database } from '@/lib/supabase.types';

type SiteUpdate = Database['public']['Tables']['site_updates']['Row'];

interface UpdateFormData {
  title: string;
  content: string;
  content_markdown: string;
  type: 'feature' | 'improvement' | 'bugfix' | 'announcement';
  priority: number;
  is_published: boolean;
  publish_date: string;
  tags: string;
}

const DEFAULT_FORM_DATA: UpdateFormData = {
  title: '',
  content: '',
  content_markdown: '',
  type: 'announcement',
  priority: 1,
  is_published: false,
  publish_date: '',
  tags: '',
};

const UPDATE_TYPE_OPTIONS = [
  { value: 'feature', label: 'Feature', color: '#7c3aed' },
  { value: 'improvement', label: 'Improvement', color: '#1e40af' },
  { value: 'bugfix', label: 'Bug Fix', color: '#059669' },
  { value: 'announcement', label: 'Announcement', color: '#d97706' },
];

export default function AdminSiteUpdatesPage() {
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<UpdateFormData>(DEFAULT_FORM_DATA);
  const [editingUpdate, setEditingUpdate] = useState<SiteUpdate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const { token } = useAdminAuth();

  // Fetch updates
  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/site-updates?include_unpublished=true&limit=100', {
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch updates');
      }

      const data = await response.json();
      setUpdates(data.updates || []);
    } catch (error) {
      console.error('Error fetching updates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch updates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUpdates();
    }
  }, [token]);

  // Form handlers
  const handleInputChange = (field: keyof UpdateFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData = {
        title: formData.title,
        content: formData.content,
        content_markdown: formData.content_markdown,
        type: formData.type,
        priority: formData.priority,
        is_published: formData.is_published,
        publish_date: formData.publish_date,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      const isEditing = editingUpdate !== null;
      const url = isEditing 
        ? `/api/site-updates?id=${editingUpdate.id}`
        : '/api/site-updates';
      
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
        throw new Error(errorData.error || 'Failed to save update');
      }

      toast({
        title: "Success",
        description: `Update ${isEditing ? 'updated' : 'created'} successfully`,
      });

      setShowForm(false);
      setEditingUpdate(null);
      setFormData(DEFAULT_FORM_DATA);
      await fetchUpdates();

    } catch (error) {
      console.error('Error saving update:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save update',
        variant: "destructive",
      });
    }
  };

  const handleEdit = (update: SiteUpdate) => {
    setEditingUpdate(update);
    setFormData({
      title: update.title,
      content: update.content,
      content_markdown: update.content_markdown || '',
      type: update.type as any,
      priority: update.priority,
      is_published: update.is_published,
      publish_date: update.publish_date ? update.publish_date.substring(0, 16) : '',
      tags: update.tags?.join(', ') || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (updateId: number) => {
    if (!confirm('Are you sure you want to delete this update?')) {
      return;
    }

    try {
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/site-updates?id=${updateId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to delete update');
      }

      toast({
        title: "Success",
        description: "Update deleted successfully",
      });

      await fetchUpdates();
    } catch (error) {
      console.error('Error deleting update:', error);
      toast({
        title: "Error",
        description: "Failed to delete update",
        variant: "destructive",
      });
    }
  };

  const togglePublished = async (update: SiteUpdate) => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/site-updates?id=${update.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_published: !update.is_published }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      await fetchUpdates();
    } catch (error) {
      console.error('Error updating:', error);
      toast({
        title: "Error",
        description: "Failed to update",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full bg-[#0e0e10] border-[#26262c]">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading updates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminProtected>
      <div className="flex flex-col md:flex-row h-screen bg-[#0e0e10]">
        <AdminSidebarMobile />
        
        <div className="flex-1 flex flex-col overflow-hidden md:ml-64 mt-16 md:mt-0" style={{
          marginTop: 'max(4rem, calc(3.5rem + env(safe-area-inset-top)))',
        }}>
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-4 md:px-6 py-4" style={{
            paddingLeft: 'max(1rem, calc(1rem + env(safe-area-inset-left)))',
            paddingRight: 'max(1rem, calc(1rem + env(safe-area-inset-right)))',
          }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">Site Updates</h1>
                <p className="text-[#ADADB8] text-xs md:text-sm">
                  Manage recent changes and updates
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-4 md:p-6" style={{
            paddingLeft: 'max(1rem, calc(1rem + env(safe-area-inset-left)))',
            paddingRight: 'max(1rem, calc(1rem + env(safe-area-inset-right)))',
            paddingBottom: 'max(1.5rem, calc(1.5rem + env(safe-area-inset-bottom)))',
          }}>
            <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-[#0e0e10] border-[#26262c]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Site Updates Management</CardTitle>
              <CardDescription className="text-[#ADADB8]">
                Create and manage site updates for the Recent Changes tab
              </CardDescription>
            </div>
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingUpdate(null);
                    setFormData(DEFAULT_FORM_DATA);
                  }}
                  className="bg-[#004D61] hover:bg-[#003a4d] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Update
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0e0e10] border-[#26262c] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingUpdate ? 'Edit Update' : 'Create New Update'}
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
                        placeholder="Update title"
                        required
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="content" className="text-white">Content</Label>
                      <Textarea
                        id="content"
                        value={formData.content}
                        onChange={(e) => handleInputChange('content', e.target.value)}
                        placeholder="Update content"
                        required
                        rows={3}
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="content_markdown" className="text-white">
                        Content (Markdown) - Optional
                      </Label>
                      <div data-color-mode="dark" className="rounded-md border border-[#26262c] overflow-hidden">
                        <MDEditor
                          value={formData.content_markdown}
                          onChange={(val) => handleInputChange('content_markdown', val || '')}
                          preview="live"
                          hideToolbar={false}
                          visibleDragbar={true}
                          height={200}
                          textareaProps={{
                            placeholder: "Use markdown for rich formatting",
                          }}
                          className="bg-[#18181b] text-white"
                          style={{
                            backgroundColor: '#18181b',
                            color: '#ffffff',
                            borderRadius: '0.375rem',
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type" className="text-white">Type</Label>
                        <Select value={formData.type} onValueChange={(value: any) => handleInputChange('type', value)}>
                          <SelectTrigger className="bg-[#18181b] border-[#26262c] text-white">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#18181b] border-[#26262c]">
                            {UPDATE_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-white hover:bg-[#26262c]">
                                {option.label}
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

                    <div>
                      <Label htmlFor="tags" className="text-white">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => handleInputChange('tags', e.target.value)}
                        placeholder="e.g., server, tracking, feature"
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_published"
                          checked={formData.is_published}
                          onCheckedChange={(checked) => handleInputChange('is_published', checked)}
                        />
                        <Label htmlFor="is_published" className="text-white">Published</Label>
                      </div>
                    </div>

                    {formData.is_published && (
                      <div>
                        <Label htmlFor="publish_date" className="text-white">Publish Date</Label>
                        <Input
                          id="publish_date"
                          type="datetime-local"
                          value={formData.publish_date}
                          onChange={(e) => handleInputChange('publish_date', e.target.value)}
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      className="bg-[#004D61] hover:bg-[#003a4d] text-white flex-1"
                    >
                      {editingUpdate ? 'Update' : 'Create'}
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

      {/* Updates List */}
      <Card className="bg-[#0e0e10] border-[#26262c]">
        <CardContent className="p-6">
          {updates.length === 0 ? (
            <div className="text-center py-8 text-[#ADADB8]">
              No updates found. Create your first update to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className="flex items-center justify-between p-4 bg-[#18181b] rounded-lg border border-[#26262c]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-white truncate">{update.title}</h3>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          update.is_published 
                            ? "border-green-600 text-green-400" 
                            : "border-gray-600 text-gray-400"
                        )}
                      >
                        {update.is_published ? 'Published' : 'Draft'}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-[#26262c] text-[#ADADB8]">
                        {update.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-[#ADADB8] truncate mb-2">{update.content}</p>
                    <div className="flex items-center gap-4 text-xs text-[#ADADB8]">
                      {update.publish_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(update.publish_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePublished(update)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      {update.is_published ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(update)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(update.id)}
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
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
