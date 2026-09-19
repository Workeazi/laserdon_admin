import { supabase } from '../config/supabaseClient';
import { activityLogService } from './activityLogService';

export const vendorService = {
  async getVendors() {
    const { data, error } = await supabase
      .from('vendors')
      .select(`
        *,
        companies (
          id,
          short_name,
          company_address,
          company_gst_number,
          company_industries (
            industries (
              name
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    console.log('Vendor Data:', data);
    console.log('Vendor Error:', error);
    console.log('Vendor Count:', data?.length);

    if (error) throw error;
    
    if (data) {
      data.forEach(v => {
        v.industries = v.companies?.company_industries?.map(ci => ci.industries).filter(Boolean) || [];
      });
    }
    
    return data;
  },

  async getVendorById(id) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*, companies (id, short_name, company_address, company_gst_number, company_industries(industries(name)))')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (data) {
      data.industries = data.companies?.company_industries?.map(ci => ci.industries).filter(Boolean) || [];
    }

    return data;
  },

  async getVendorPayments(vendorId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateVendorStatus(id, newStatus, currentAdminId, reason = '') {
    console.log('Updating Vendor Status', {
      vendorId: id,
      status: newStatus,
      adminId: currentAdminId,
      reason
    });
    
    const updates = { 
      status: newStatus, 
      updated_at: new Date().toISOString() 
    };

    if (newStatus === 'approved') {
      updates.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    console.log('Update Result:', data);
    console.log('Update Error:', error);

    if (error) throw error;
    
    const action = newStatus === 'approved' ? 'APPROVE_VENDOR' : newStatus === 'rejected' ? 'REJECT_VENDOR' : 'UPDATE_VENDOR_STATUS';
    
    try {
      const result = await activityLogService.logAction(currentAdminId, action, 'VENDORS', id, { vendor_id: id, status: newStatus, reason });
      console.log('Activity Log Result:', result);
    } catch (e) {
      console.log('Activity Log Error:', e);
    }

    return data;
  },

  async updateDocumentStatus(id, newStatus, currentAdminId) {
    const updates = { 
      document_status: newStatus, 
      updated_at: new Date().toISOString() 
    };

    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    const action = newStatus === 'verified' ? 'VERIFY_DOCUMENT' : 'REJECT_DOCUMENT';
    
    try {
      await activityLogService.logAction(currentAdminId, action, 'VERIFY_DOCS', id, { vendor_id: id });
    } catch (e) {
      console.warn('Could not log admin activity', e);
    }

    return data;
  },

  async getVendorBusinessDocumentsUrls(vendorId) {
    const bucket = 'vendor_business_documents';
    const urls = [];

    try {
      // Get the company_id for this vendor to check multiple possible folder/file structures
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('company_id')
        .eq('id', vendorId)
        .single();

      // Check subfolders
      const foldersToTry = [vendorId.toString()];
      if (vendorData && vendorData.company_id) {
        foldersToTry.push(vendorData.company_id.toString());
      }
      
      let debugCheckedPaths = [];

      for (const folder of foldersToTry) {
        debugCheckedPaths.push(folder);
        const { data: files, error } = await supabase.storage.from(bucket).list(folder);
        
        if (error) {
          console.error(`Storage list error for folder ${folder}:`, error);
        }
        
        if (files && files.length > 0) {
          for (const file of files) {
            if (file.name === '.emptyFolder') continue;
            const filePath = `${folder}/${file.name}`;
            const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
            if (publicUrlData && publicUrlData.publicUrl) {
              urls.push(publicUrlData.publicUrl);
            }
          }
        }
      }

      // If nothing found in subfolders, try the root directory (maybe files are prefixed with ID)
      if (urls.length === 0) {
        const { data: rootFiles } = await supabase.storage.from(bucket).list('');
        if (rootFiles && rootFiles.length > 0) {
          for (const file of rootFiles) {
            if (file.name === '.emptyFolder' || !file.name) continue;
            
            // If the file name includes the vendor ID or company ID
            if (file.name.includes(vendorId) || (vendorData && vendorData.company_id && file.name.includes(vendorData.company_id))) {
              const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(file.name);
              if (publicUrlData && publicUrlData.publicUrl) {
                urls.push(publicUrlData.publicUrl);
              }
            }
          }
        }
      }
      
      if (urls.length === 0) {
        throw new Error(`Checked folders: ${debugCheckedPaths.join(', ')} but found 0 files. Make sure the folder name in Supabase EXACTLY matches one of these.`);
      }
      
      // Still nothing? Try grabbing ANY files in the bucket if there are very few (as a fallback debug)
      if (urls.length === 0) {
        console.warn(`No documents explicitly matched ${vendorId} or company ${vendorData?.company_id}.`);
      }

    } catch (err) {
      console.error(`Could not fetch from bucket ${bucket} for vendor ${vendorId}`, err);
      throw err; // Re-throw so VerifyDocsPage can catch it and display it in the toast!
    }
    
    return urls;
  },

  async getVendorQuotationStats(vendorId) {
    const { data, error } = await supabase
      .from('quotations')
      .select('status')
      .eq('vendor_id', vendorId);

    if (error) throw error;

    const stats = {
      submitted: 0,
      approved: 0,
      rejected: 0
    };

    if (data) {
      data.forEach(q => {
        const s = q.status || 'submitted';
        if (stats[s] !== undefined) {
          stats[s]++;
        } else {
          stats['submitted']++; // fallback
        }
      });
    }

    return stats;
  },

  async getVendorQuotationTrend(vendorId) {
    const { data, error } = await supabase
      .from('quotations')
      .select('created_at')
      .eq('vendor_id', vendorId);

    if (error) throw error;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap = monthNames.reduce((acc, month) => ({ ...acc, [month]: 0 }), {});

    if (data) {
      data.forEach(q => {
        if (q.created_at) {
          const d = new Date(q.created_at);
          const month = monthNames[d.getMonth()];
          if (trendMap[month] !== undefined) {
            trendMap[month]++;
          }
        }
      });
    }

    return monthNames.map(month => ({
      name: month,
      quotations: trendMap[month]
    }));
  },

  async getVendorRevenue(vendorId) {
    const { data, error } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .eq('vendor_id', vendorId);

    if (error) throw error;

    let totalRevenue = 0;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap = monthNames.reduce((acc, month) => ({ ...acc, [month]: 0 }), {});

    if (data) {
      data.forEach(p => {
        const amt = Number(p.amount) || 0;
        totalRevenue += amt;
        
        if (p.payment_date) {
          const d = new Date(p.payment_date);
          const month = monthNames[d.getMonth()];
          if (trendMap[month] !== undefined) {
            trendMap[month] += amt;
          }
        }
      });
    }

    const revenueTrend = monthNames.map(month => ({
      name: month,
      revenue: trendMap[month]
    }));

    return { totalRevenue, revenueTrend };
  },

  async fetchRealVendorAnalytics(vendorId, isSuperAdmin) {
    const stats = await this.getVendorQuotationStats(vendorId);
    const quotationTrend = await this.getVendorQuotationTrend(vendorId);
    
    let revenueData = { totalRevenue: 0, revenueTrend: [] };
    if (isSuperAdmin) {
      revenueData = await this.getVendorRevenue(vendorId);
    }

    // Conversion Rate
    const totalQuotations = stats.submitted + stats.approved + stats.rejected;
    const rate = totalQuotations > 0 ? Math.round((stats.approved / totalQuotations) * 100) : 0;
    const quotationConversion = {
      received: totalQuotations,
      accepted: stats.approved,
      rejected: stats.rejected,
      rate
    };

    // Status Distribution (Pie Chart)
    const statusDistribution = [
      { name: 'Submitted', value: stats.submitted },
      { name: 'Approved', value: stats.approved },
      { name: 'Rejected', value: stats.rejected }
    ].filter(item => item.value > 0); // Only show non-zero in pie

    return {
      kpis: {
        submittedQuotations: totalQuotations, // count of all
        approvedQuotations: stats.approved,
        rejectedQuotations: stats.rejected,
        totalRevenue: revenueData.totalRevenue
      },
      charts: {
        quotationTrend,
        quotationStatusDistribution: statusDistribution,
        quotationConversion,
        revenueTrend: revenueData.revenueTrend
      }
    };
  }
};
