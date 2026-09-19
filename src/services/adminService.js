import { supabaseAdmin as supabase } from '../config/supabaseClient';
import bcrypt from 'bcryptjs';
import { activityLogService } from './activityLogService';

export const adminService = {
  async getAdmins() {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAdminById(id) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createAdmin(adminData, currentAdminId) {
    const newAdmin = {
      name: adminData.name,
      email: adminData.email,
      password_hash: adminData.password,
      role: adminData.role || 'sub_admin',
      status: adminData.status || 'active',
      created_by: currentAdminId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('admins')
      .insert([newAdmin])
      .select()
      .single();

    if (error) throw error;

    const metadata = {
      name: adminData.name,
      email: adminData.email,
      role: 'sub_admin'
    };

    const action = newAdmin.role === 'master_admin' ? 'CREATE_ADMIN' : 'CREATE_SUB_ADMIN';
    await activityLogService.logAction(currentAdminId, action, 'ADMIN_MANAGEMENT', data.id, metadata);

    return data;
  },

  async updateAdmin(id, updates, currentAdminId) {
    if (updates.password) {
      updates.password_hash = bcrypt.hashSync(updates.password, 10);
      delete updates.password;
    }
    
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('admins')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await activityLogService.logAction(currentAdminId, 'Update Admin', 'admins', id);

    return data;
  },

  async disableAdmin(id, currentAdminId) {
    const { data, error } = await supabase
      .from('admins')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await activityLogService.logAction(currentAdminId, 'Disable Admin', 'admins', id);

    return data;
  },

  async deleteAdmin(id, currentAdminId) {
    const { data, error } = await supabase
      .from('admins')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await activityLogService.logAction(currentAdminId, 'Delete Admin', 'admins', id);

    return data;
  }
};
