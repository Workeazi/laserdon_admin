import { supabase } from '../config/supabaseClient';
import bcrypt from 'bcryptjs';

export const authService = {
  async login(email, password) {
    console.log('Email:', email);
    console.log('Supabase Query: supabase.from("admins").select("*").eq("email", email).maybeSingle()');

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    console.log('Supabase Result:', admin);
    console.log('Supabase Error:', error);
    console.log('Supabase Error Details:', error?.details);
    console.log('Supabase Error Code:', error?.code);

    if (error) {
      throw new Error(error.message);
    }

    if (!admin) {
      throw new Error('Invalid email or password.');
    }

    console.log('Admin Found:', admin);
    console.log('Stored Password:', admin?.password_hash);
    console.log('Admin Status:', admin?.status);
    console.log('Admin Role:', admin?.role);

    if (password !== admin.password_hash) {
      throw new Error('Invalid email or password.');
    }

    if (admin.status !== 'active') {
      throw new Error('Account is inactive. Please contact Master Admin.');
    }

    // Store session info
    const sessionData = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };

    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('admin', JSON.stringify(sessionData));

    return sessionData;
  },

  logout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('admin');
  },

  getCurrentAdmin() {
    const adminStr = localStorage.getItem('admin');
    if (!adminStr) return null;
    
    try {
      const admin = JSON.parse(adminStr);
      // Invalidate if the ID is a legacy mock ID instead of a UUID
      if (admin && admin.id && admin.id.startsWith('admin')) {
        this.logout();
        window.location.href = '/login';
        return null;
      }
      return admin;
    } catch (e) {
      return null;
    }
  },

  checkSession() {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) return false;
    
    const admin = this.getCurrentAdmin();
    return !!admin;
  }
};
