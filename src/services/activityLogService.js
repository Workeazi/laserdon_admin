import { supabase } from '../config/supabaseClient';

export const activityLogService = {
  async logAction(adminId, action, module, targetId, metadata = null) {
    const payload = {
      admin_id: adminId,
      action: action,
      module: module,
      target_id: targetId,
      created_at: new Date().toISOString()
    };
    if (metadata) {
      payload.metadata = metadata;
    }
    console.log('Creating Activity Log...');
    console.log('Activity Payload:', payload);
    
    const result = await supabase
      .from('admin_activity_logs')
      .insert([payload]);

    const { error } = result;
    console.log('Activity Result:', result);
    console.log('Activity Error:', error);

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('Activity logging skipped: admin_activity_logs table does not exist.');
      } else {
        console.error('Failed to log activity:', error);
      }
    }

    return result;
  },

  async logAdminActivityLogin(adminId, action, module, targetId) {
    const { error } = await supabase
      .from('admin_activity_login')
      .insert([{
        admin_id: adminId,
        action: action,
        module: module,
        target_id: targetId,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Failed to log admin activity login:', error);
    }
  },

  async getLogs(limit = 100) {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('*, admins(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
};