import { supabase } from '../config/supabaseClient';

export const dashboardService = {
  async getDashboardStats(role = 'master_admin') {
    try {
      const isMasterAdmin = role === 'master_admin';
      
      // Base queries for both roles
      const promises = [
        supabase.from('vendors').select('*', { count: 'exact', head: true }),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('document_status', 'uploaded'),
      ];

      if (isMasterAdmin) {
        // Master Admin specific queries
        promises.push(
          supabase.from('payments').select('*', { count: 'exact', head: true }),
          supabase.from('payments').select('amount')
        );
      }

      const results = await Promise.all(promises);
      
      results.forEach((res, idx) => {
        if (res.error) console.log(`Dashboard Stats Error [${idx}]:`, res.error);
      });
      
      const totalVendors = results[0].count || 0;
      const pendingVendors = results[1].count || 0;
      const approvedVendors = results[2].count || 0;
      const rejectedVendors = results[3].count || 0;
      const pendingDocuments = results[4].count || 0;

      let stats = {
        totalVendors,
        pendingVendors,
        approvedVendors,
        rejectedVendors,
        pendingDocuments,
      };

      if (isMasterAdmin) {
        const totalPayments = results[5].count || 0;
        const totalRevenue = (results[6].data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        
        stats = {
          ...stats,
          totalPayments,
          totalRevenue,
        };
      }

      console.log('Dashboard Stats:', stats);
      return stats;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  async getChartData(role = 'master_admin') {
    try {
      const isMasterAdmin = role === 'master_admin';
      
      // Base queries
      const promises = [
        supabase.from('vendors').select('id, created_at, status, document_status')
      ];

      if (isMasterAdmin) {
        promises.push(
          supabase.from('payments').select('id, payment_date, amount, vendor_id, vendors(username, companies(short_name))'),
          supabase.from('vendors').select('*, companies(id, short_name, company_address, company_gst_number)').eq('status', 'pending').order('created_at', { ascending: false }).limit(10)
        );
      } else {
        promises.push(
          // pending queue query
          supabase.from('vendors').select('*, companies(id, short_name, company_address, company_gst_number)').eq('status', 'pending').order('created_at', { ascending: false }).limit(10)
        );
      }

      const results = await Promise.all(promises);
      
      results.forEach((res, idx) => {
        if (res.error) console.log(`Dashboard Chart Error [${idx}]:`, res.error);
      });

      const vendorsData = results[0].data || [];
      console.log('Dashboard Vendors:', vendorsData);

      // Helper for grouping by month
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const aggregateByMonth = (data, dateKey, valueFn) => {
        const counts = {};
        data.forEach(item => {
          if (!item[dateKey]) return;
          const date = new Date(item[dateKey]);
          const month = monthNames[date.getMonth()];
          counts[month] = (counts[month] || 0) + valueFn(item);
        });
        return counts;
      };

      // Helper for grouping by status
      const aggregateByStatus = (data) => {
        return data.reduce((acc, curr) => {
          const status = curr.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
      };

      const vendorStatusCounts = aggregateByStatus(vendorsData);
      
      // Vendor Status Distribution Pie Chart Data
      const vendorStatusDistribution = Object.keys(vendorStatusCounts).map(status => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: vendorStatusCounts[status]
      }));

      // Monthly Vendor Registrations
      const vendorCountsByMonth = aggregateByMonth(vendorsData, 'created_at', () => 1);
      
      // Monthly Activity (Approved, Rejected, Pending)
      const approvedVendorsByMonth = aggregateByMonth(vendorsData.filter(v => v.status === 'approved'), 'created_at', () => 1);
      const rejectedVendorsByMonth = aggregateByMonth(vendorsData.filter(v => v.status === 'rejected'), 'created_at', () => 1);
      const pendingVendorsByMonth = aggregateByMonth(vendorsData.filter(v => v.status === 'pending'), 'created_at', () => 1);

      let chartData = {
        vendorStatusDistribution,
        monthlyVendorRegistrations: monthNames.map(month => ({
          name: month,
          vendors: vendorCountsByMonth[month] || 0,
        })),
        vendorActivityTrend: monthNames.map(month => ({
          name: month,
          approved: approvedVendorsByMonth[month] || 0,
          rejected: rejectedVendorsByMonth[month] || 0,
          pending: pendingVendorsByMonth[month] || 0,
          new: vendorCountsByMonth[month] || 0,
        }))
      };

      if (isMasterAdmin) {
        const paymentsData = results[1].data || [];

        const revenueSumsByMonth = aggregateByMonth(paymentsData, 'payment_date', (item) => Number(item.amount) || 0);

        // Top Vendors by Revenue
        const vendorRevenueMap = paymentsData.reduce((acc, curr) => {
          const vendorId = curr.vendor_id;
          const vendorInfo = curr.vendors || {};
          const name = vendorInfo.companies?.short_name || vendorInfo.username || `Vendor ${vendorId}`;
          acc[name] = (acc[name] || 0) + (Number(curr.amount) || 0);
          return acc;
        }, {});

        const topVendorsByRevenue = Object.entries(vendorRevenueMap)
          .map(([name, revenue]) => ({ name, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        // Vendor Growth vs Revenue Growth
        const growthComparison = monthNames.map(month => ({
          name: month,
          vendors: vendorCountsByMonth[month] || 0,
          revenue: revenueSumsByMonth[month] || 0
        }));

        const pendingVendorQueue = results[2]?.data || [];

        chartData = {
          ...chartData,
          revenueTrend: monthNames.map(month => ({
            name: month,
            revenue: revenueSumsByMonth[month] || 0,
          })),
          topVendorsByRevenue,
          growthComparison,
          pendingVendorQueue,
        };
      } else {
        const pendingVendorQueue = results[1].data || [];
        console.log('Pending Vendor Queue Data:', pendingVendorQueue);
        console.log('Pending Vendor Queue Error:', results[1].error);

        const docStatusCounts = vendorsData.reduce((acc, curr) => {
          const docStatus = curr.document_status || 'pending';
          acc[docStatus] = (acc[docStatus] || 0) + 1;
          return acc;
        }, {});
        
        const documentVerificationStatus = Object.keys(docStatusCounts).map(status => ({
          name: status.charAt(0).toUpperCase() + status.slice(1),
          value: docStatusCounts[status]
        }));

        chartData = {
          ...chartData,
          documentVerificationStatus,
          pendingVendorQueue
        };
      }

      console.log('Dashboard Charts:', chartData);
      return chartData;
    } catch (error) {
      console.error('Error fetching chart data:', error);
      throw error;
    }
  }
};
