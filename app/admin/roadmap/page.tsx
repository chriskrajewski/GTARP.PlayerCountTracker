"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, TrendingUp } from 'lucide-react';
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

type RoadmapItem = Database['public']['Tables']['roadmap_items']['Row'];

interface RoadmapFormData {
  title: string;
  description: string;
  description_markdown: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  category: string;
  is_published: boolean;
  display_order: number;
}

const DEFAULT_FORM_DATA: RoadmapFormData = {
  title: '',
  description: '',
  description_markdown: '',
  status: 'planned',
  priority: 1,
  category: '',
  is_published: false,
  display_order: 0,
};

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned', color: '#1e40af' },
  { value: 'in_progress', label: 'In Progress', color: '#d97706' },
  { value: 'completed', label: 'Completed', color: '#059669' },
  { value: 'cancelled', label: 'Cancelled', color: '#6b7280' },
];

const CATEGORIES = [
  'Server Tracking',
  'Analytics',
  'UI/UX',
  'Performance',
  'Security',
];

export default function AdminRoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<RoadmapFormData>(DEFAULT_FORM_DATA);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const { token } = useAdminAuth();

  // Fetch roadmap items
  const fetchItems = async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/roadmap?include_unpublished=true&limit=100', {
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch roadmap items');
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch roadmap items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchItems();
    }
  }, [token]);

  // Form handlers
  const handleInputChange = (field: keyof RoadmapFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData = {
        title: formData.title,
        description: formData.description,
        description_markdown: formData.description_markdown,
        status: formData.status,
        priority: formData.priority,
        category: formData.category,
        is_published: formData.is_published,
        display_order: formData.display_order,
      };

      const isEditing = editingItem !== null;
      const url = isEditing 
        ? `/api/roadmap?id=${editingItem.id}`
        : '/api/roadmap';
      
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
        throw new Error(errorData.error || 'Failed to save roadmap item');
      }

      toast({
        title: "Success",
        description: `Roadmap item ${isEditing ? 'updated' : 'created'} successfully`,
      });

      setShowForm(false);
      setEditingItem(null);
      setFormData(DEFAULT_FORM_DATA);
      await fetchItems();

    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save roadmap item',
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: RoadmapItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      description_markdown: item.description_markdown || '',
      status: item.status as any,
      priority: item.priority,
      category: item.category || '',
      is_published: item.is_published,
      display_order: item.display_order,
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('Are you sure you want to delete this roadmap item?')) {
      return;
    }

    try {
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/roadmap?id=${itemId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      toast({
        title: "Success",
        description: "Roadmap item deleted successfully",
      });

      await fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete roadmap item",
        variant: "destructive",
      });
    }
  };

  const togglePublished = async (item: RoadmapItem) => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/roadmap?id=${item.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_published: !item.is_published }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      await fetchItems();
    } catch (error) {
      console.error('Error updating:', error);
      toast({
        title: "Error",
        description: "Failed to update roadmap item",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full bg-[#0e0e10] border-[#26262c]">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading roadmap items...</div>
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
                <h1 className="text-xl md:text-2xl font-bold text-white">Roadmap</h1>
                <p className="text-[#ADADB8] text-xs md:text-sm">
                  Manage roadmap items and features
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
              <CardTitle className="text-white">Roadmap Management</CardTitle>
              <CardDescription className="text-[#ADADB8]">
                Create and manage roadmap items with voting support
              </CardDescription>
            </div>
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setFormData(DEFAULT_FORM_DATA);
                  }}
                  className="bg-[#004D61] hover:bg-[#003a4d] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Item
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0e0e10] border-[#26262c] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? 'Edit Roadmap Item' : 'Create New Roadmap Item'}
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
                        placeholder="Feature title"
                        required
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-white">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Feature description"
                        required
                        rows={3}
                        className="bg-[#18181b] border-[#26262c] text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description_markdown" className="text-white">
                        Description (Markdown) - Optional
                      </Label>
                      <div data-color-mode="dark" className="rounded-md border border-[#26262c] overflow-hidden">
                        <MDEditor
                          value={formData.description_markdown}
                          onChange={(val) => handleInputChange('description_markdown', val || '')}
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
                        <Label htmlFor="status" className="text-white">Status</Label>
                        <Select value={formData.status} onValueChange={(value: any) => handleInputChange('status', value)}>
                          <SelectTrigger className="bg-[#18181b] border-[#26262c] text-white">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#18181b] border-[#26262c]">
                            {STATUS_OPTIONS.map((option) => (
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category" className="text-white">Category</Label>
                        <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                          <SelectTrigger className="bg-[#18181b] border-[#26262c] text-white">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#18181b] border-[#26262c]">
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-white hover:bg-[#26262c]">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="display_order" className="text-white">Display Order</Label>
                        <Input
                          id="display_order"
                          type="number"
                          value={formData.display_order}
                          onChange={(e) => handleInputChange('display_order', parseInt(e.target.value))}
                          className="bg-[#18181b] border-[#26262c] text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_published"
                        checked={formData.is_published}
                        onCheckedChange={(checked) => handleInputChange('is_published', checked)}
                      />
                      <Label htmlFor="is_published" className="text-white">Published</Label>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      className="bg-[#004D61] hover:bg-[#003a4d] text-white flex-1"
                    >
                      {editingItem ? 'Update' : 'Create'}
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

      {/* Items List */}
      <Card className="bg-[#0e0e10] border-[#26262c]">
        <CardContent className="p-6">
          {items.length === 0 ? (
            <div className="text-center py-8 text-[#ADADB8]">
              No roadmap items found. Create your first item to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-[#18181b] rounded-lg border border-[#26262c]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-white truncate">{item.title}</h3>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          item.is_published 
                            ? "border-green-600 text-green-400" 
                            : "border-gray-600 text-gray-400"
                        )}
                      >
                        {item.is_published ? 'Published' : 'Draft'}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-[#26262c] text-[#ADADB8]">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[#ADADB8] truncate mb-2">{item.description}</p>
                    <div className="flex items-center gap-4 text-xs text-[#ADADB8]">
                      {item.category && (
                        <span className="px-2 py-1 bg-[#26262c]/50 rounded text-xs">
                          {item.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {item.vote_count} votes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePublished(item)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      {item.is_published ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(item)}
                      className="border-[#26262c] text-white hover:bg-[#26262c]"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id)}
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
