import { AdminLogin } from '@/components/admin-login-supabase';

export const metadata = {
  title: 'Admin Login - GTA RP Player Count Tracker',
  description: 'Sign in to the admin dashboard',
};

export default function AdminLoginPage() {
  return <AdminLogin />;
}
