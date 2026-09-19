import { supabase } from '../config/supabaseClient';
import { activityLogService } from './activityLogService';

export const paymentService = {
  async getPayments() {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        vendors (
          id,
          username,
          companies (
            id,
            short_name
          )
        )
      `)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
    return data || [];
  },

  async getPaymentById(id) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        vendors (
          id,
          username,
          companies (
            id,
            short_name
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching payment with id ${id}:`, error);
      throw error;
    }
    return data;
  },

  async updatePaymentStatus(paymentId, newStatus, adminId, reason = '') {
    const { data: currentPayment, error: fetchError } = await supabase
      .from('payments')
      .select('payment_status')
      .eq('id', paymentId)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('payments')
      .update({ payment_status: newStatus })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    await activityLogService.logActivity({
      admin_id: adminId,
      action: 'update',
      entity_type: 'payment',
      entity_id: paymentId,
      details: `Updated payment status from ${currentPayment.payment_status} to ${newStatus}${reason ? `. Reason: ${reason}` : ''}`,
      ip_address: '127.0.0.1' // This should ideally come from the request context
    });

    return data;
  }
};
