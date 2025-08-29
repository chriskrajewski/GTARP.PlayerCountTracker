"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  ShieldCheck,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Key,
  AlertTriangle
} from 'lucide-react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminAPI } from '@/lib/admin-api';
import type { AdminUser, AdminRole, UserSession } from '@/lib/admin-types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userDialog, setUserDialog] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    username: '',
    full_name: '',
    role_id: '',
    is_active: true,
    password: '',
    phone: '',
    department: ''
  });

  useEffect(() => {
    loadUsersData();
  }, []);

  const loadUsersData = async () => {
    try {
      setLoading(true);
      
      // Load mock data for demonstration
      const mockUsers: AdminUser[] = [
        {
          id: '1',
          email: 'admin@gtarp.com',
          username: 'admin',
          full_name: 'System Administrator',
          role_id: 'super_admin',
          role_name: 'Super Admin',
          is_active: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
          last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          login_attempts: 0,
          permissions: ['all'],
          phone: '+1-555-0123',
          department: 'IT',
          profile_image: '',
          two_factor_enabled: true,
          created_by: 'system',
          updated_by: 'admin'
        },
        {
          id: '2',
          email: 'moderator@gtarp.com',
          username: 'moderator1',
          full_name: 'John Smith',
          role_id: 'moderator',
          role_name: 'Moderator',
          is_active: true,
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          last_login: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          login_attempts: 0,
          permissions: ['read_users', 'manage_servers', 'view_analytics'],
          phone: '+1-555-0124',
          department: 'Community',
          profile_image: '',
          two_factor_enabled: false,
          created_by: 'admin',
          updated_by: 'admin'
        },
        {
          id: '3',
          email: 'viewer@gtarp.com',
          username: 'viewer1',
          full_name: 'Jane Doe',
          role_id: 'viewer',
          role_name: 'Viewer',
          is_active: false,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          last_login: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          login_attempts: 3,
          permissions: ['read_only'],
          phone: '',
          department: 'Support',
          profile_image: '',
          two_factor_enabled: false,
          created_by: 'admin',
          updated_by: 'moderator1'
        }
      ];

      const mockRoles: AdminRole[] = [
        {
          id: 'super_admin',
          name: 'Super Admin',
          description: 'Full system access with all permissions',
          permissions: ['all'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'system'
        },
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Administrative access with most permissions',
          permissions: ['manage_users', 'manage_servers', 'view_analytics', 'manage_config'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'system'
        },
        {
          id: 'moderator',
          name: 'Moderator',
          description: 'Limited administrative access',
          permissions: ['read_users', 'manage_servers', 'view_analytics'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'system'
        },
        {
          id: 'viewer',
          name: 'Viewer',
          description: 'Read-only access to system data',
          permissions: ['read_only'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'system'
        }
      ];

      const mockSessions: UserSession[] = [
        {
          id: '1',
          user_id: '1',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          last_activity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          user_id: '2',
          ip_address: '192.168.1.101',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        }
      ];

      setUsers(mockUsers);
      setRoles(mockRoles);
      setSessions(mockSessions);
    } catch (error) {
      console.error('Error loading users data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      // Mock implementation - would use adminAPI.createUser(userForm)
      const newUser: AdminUser = {
        id: Date.now().toString(),
        ...userForm,
        role_name: roles.find(r => r.id === userForm.role_id)?.name || '',
        permissions: roles.find(r => r.id === userForm.role_id)?.permissions || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: null,
        login_attempts: 0,
        profile_image: '',
        two_factor_enabled: false,
        created_by: 'admin',
        updated_by: 'admin'
      };
      
      setUsers(prev => [...prev, newUser]);
      setUserDialog(false);
      setUserForm({
        email: '',
        username: '',
        full_name: '',
        role_id: '',
        is_active: true,
        password: '',
        phone: '',
        department: ''
      });
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<AdminUser>) => {
    try {
      // Mock implementation - would use adminAPI.updateUser(userId, updates)
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, ...updates, updated_at: new Date().toISOString() } : user
      ));
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Mock implementation - would use adminAPI.deleteUser(userId)
      setUsers(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      // Mock implementation - would use adminAPI.resetUserPassword(userId)
      console.log('Password reset for user:', userId);
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role_id === filterRole;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading users...</span>
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
                  <Users className="mr-3 h-6 w-6" />
                  User Management
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Manage admin users, roles, and permissions
                </p>
              </div>
              
              <Dialog open={userDialog} onOpenChange={setUserDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-[#9147ff] hover:bg-[#772ce8] text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1a1a1e] border-[#26262c] text-white max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription className="text-[#ADADB8]">
                      Add a new admin user to the system
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Email</Label>
                      <Input
                        value={userForm.email}
                        onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white"
                        placeholder="user@example.com"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-white">Username</Label>
                      <Input
                        value={userForm.username}
                        onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white"
                        placeholder="username"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-white">Full Name</Label>
                      <Input
                        value={userForm.full_name}
                        onChange={(e) => setUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white"
                        placeholder="John Doe"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-white">Role</Label>
                      <Select value={userForm.role_id} onValueChange={(value) => setUserForm(prev => ({ ...prev, role_id: value }))}>
                        <SelectTrigger className="bg-[#26262c] border-[#40404a] text-white">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#26262c] border-[#40404a]">
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id} className="text-white">
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-white">Password</Label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                        className="bg-[#26262c] border-[#40404a] text-white"
                        placeholder="Enter secure password"
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setUserDialog(false)}
                      className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateUser}
                      className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                      disabled={!userForm.email || !userForm.username || !userForm.role_id || !userForm.password}
                    >
                      Create User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <Tabs defaultValue="users" className="space-y-4">
                <TabsList className="bg-[#26262c] border-[#40404a]">
                  <TabsTrigger value="users" className="data-[state=active]:bg-[#9147ff] data-[state=active]:text-white">
                    <Users className="h-4 w-4 mr-2" />
                    Users
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="data-[state=active]:bg-[#9147ff] data-[state=active]:text-white">
                    <Shield className="h-4 w-4 mr-2" />
                    Roles & Permissions
                  </TabsTrigger>
                  <TabsTrigger value="sessions" className="data-[state=active]:bg-[#9147ff] data-[state=active]:text-white">
                    <Clock className="h-4 w-4 mr-2" />
                    Active Sessions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4">
                  {/* User filters */}
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-[#ADADB8]" />
                            <Input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search users..."
                              className="pl-10 bg-[#26262c] border-[#40404a] text-white"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger className="w-40 bg-[#26262c] border-[#40404a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#26262c] border-[#40404a]">
                              <SelectItem value="all" className="text-white">All Roles</SelectItem>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id} className="text-white">
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-32 bg-[#26262c] border-[#40404a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#26262c] border-[#40404a]">
                              <SelectItem value="all" className="text-white">All Status</SelectItem>
                              <SelectItem value="active" className="text-white">Active</SelectItem>
                              <SelectItem value="inactive" className="text-white">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Users list */}
                  <div className="grid gap-4">
                    {filteredUsers.map((user) => (
                      <Card key={user.id} className="bg-[#1a1a1e] border-[#26262c]">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 rounded-full bg-[#9147ff] flex items-center justify-center">
                                <Users className="h-6 w-6 text-white" />
                              </div>
                              
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium text-white">{user.full_name}</h3>
                                  <Badge 
                                    variant="outline" 
                                    className={user.is_active 
                                      ? "border-emerald-400/30 text-emerald-400 bg-emerald-400/10" 
                                      : "border-red-400/30 text-red-400 bg-red-400/10"
                                    }
                                  >
                                    {user.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                  {user.two_factor_enabled && (
                                    <Badge variant="outline" className="border-blue-400/30 text-blue-400 bg-blue-400/10">
                                      <Shield className="h-3 w-3 mr-1" />
                                      2FA
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-4 text-sm text-[#ADADB8] mt-1">
                                  <span className="flex items-center">
                                    <Mail className="h-3 w-3 mr-1" />
                                    {user.email}
                                  </span>
                                  <span className="flex items-center">
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    {user.role_name}
                                  </span>
                                  {user.last_login && (
                                    <span className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Last login: {new Date(user.last_login).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateUser(user.id, { is_active: !user.is_active })}
                                className={`border-[#40404a] text-white hover:bg-[#26262c] ${
                                  user.is_active ? 'hover:text-red-400' : 'hover:text-emerald-400'
                                }`}
                              >
                                {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetPassword(user.id)}
                                className="border-[#40404a] text-white hover:bg-[#26262c] hover:text-amber-400"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-[#40404a] text-white hover:bg-[#26262c] hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-[#1a1a1e] border-[#26262c]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
                                    <AlertDialogDescription className="text-[#ADADB8]">
                                      Are you sure you want to delete {user.full_name}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      Delete
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
                </TabsContent>

                <TabsContent value="roles" className="space-y-4">
                  <div className="grid gap-4">
                    {roles.map((role) => (
                      <Card key={role.id} className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 rounded bg-[#26262c]">
                                <Shield className="h-5 w-5 text-[#ADADB8]" />
                              </div>
                              <div>
                                <CardTitle className="text-white">{role.name}</CardTitle>
                                <CardDescription className="text-[#ADADB8]">
                                  {role.description}
                                </CardDescription>
                              </div>
                            </div>
                            
                            <Badge variant="outline" className="border-[#40404a] text-[#ADADB8]">
                              {users.filter(u => u.role_id === role.id).length} users
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div>
                            <Label className="text-white font-medium">Permissions:</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {role.permissions.map((permission) => (
                                <Badge 
                                  key={permission} 
                                  variant="outline" 
                                  className="border-[#9147ff]/30 text-[#9147ff] bg-[#9147ff]/10"
                                >
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="sessions" className="space-y-4">
                  <div className="grid gap-4">
                    {sessions.map((session) => {
                      const user = users.find(u => u.id === session.user_id);
                      return (
                        <Card key={session.id} className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                  <UserCheck className="h-5 w-5 text-emerald-400" />
                                </div>
                                
                                <div>
                                  <h3 className="font-medium text-white">{user?.full_name || 'Unknown User'}</h3>
                                  <div className="flex items-center space-x-4 text-sm text-[#ADADB8] mt-1">
                                    <span className="flex items-center">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {session.ip_address}
                                    </span>
                                    <span className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Active: {new Date(session.last_activity).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant="outline" 
                                  className="border-emerald-400/30 text-emerald-400 bg-emerald-400/10"
                                >
                                  Active
                                </Badge>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-[#40404a] text-white hover:bg-[#26262c] hover:text-red-400"
                                >
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}