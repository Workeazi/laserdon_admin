import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Tabs, Tab, Typography, Select, MenuItem, FormControl } from '@mui/material';
import toast from 'react-hot-toast';
import { supabase } from '../../config/supabaseClient';
import { vendorService } from '../../services/vendorService';
import { authService } from '../../services/authService';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const NotificationCenterPage = () => {
 const navigate = useNavigate();
 const [vendors, setVendors] = useState([]);
 const [loading, setLoading] = useState(true);
 const [actionModal, setActionModal] = useState({ open: false, type: '', vendorId: null, oldStatus: '', newStatus: '' });
 const [rejectionReason, setRejectionReason] = useState('');
 const [tabValue, setTabValue] = useState(0);
 const currentAdmin = authService.getCurrentAdmin();

 const fetchVendors = async () => {
 try {
 const { data, error } = await supabase
 .from('vendors')
 .select(`
 *,
 companies (
 id,
 short_name,
 company_address,
 company_gst_number
 )
 `)
 .in('status', ['pending', 'approved', 'rejected'])
 .order('created_at', { ascending: false });

 if (error) throw error;
 console.log('Vendor:', data?.[0]);
 console.log('Company:', data?.[0]?.companies);
 setVendors(data || []);
 } catch (error) {
 console.error('Error fetching pending vendors:', error);
 toast.error('Failed to load notifications');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchVendors();

 const channel = supabase
 .channel('notification-page-vendors')
 .on(
 'postgres_changes',
 { event: '*', schema: 'public', table: 'vendors' },
 (payload) => {
 fetchVendors();
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, []);

 const handleAction = async () => {
 if (!actionModal.vendorId) return;

 try {
 await vendorService.updateVendorStatus(
 actionModal.vendorId, 
 actionModal.newStatus, 
 currentAdmin.id,
 rejectionReason
 );
 toast.success(`Vendor status updated successfully`);
 setActionModal({ open: false, type: '', vendorId: null, oldStatus: '', newStatus: '' });
 setRejectionReason('');
 fetchVendors();
 } catch (error) {
 console.error(`Error updating vendor status:`, error);
 toast.error(error.message || `Failed to update status`);
 }
 };

 const columns = [
 { field: 'company_name', headerName: 'Company Name', renderCell: (row) => row.companies?.short_name || 'N/A' },
 { field: 'username', headerName: 'Vendor Name' },
 { field: 'email', headerName: 'Email' },
 { 
 field: 'created_at', 
 headerName: 'Created Date', 
 renderCell: (row) => new Date(row.created_at).toLocaleDateString()
 },
 { 
 field: 'status', 
 headerName: 'Status', 
 renderCell: (row) => <StatusBadge status={row.status} module="vendor" />
 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 250,
      renderCell: (row) => (
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' ? (
            <>
              <Button 
                size="small" 
                variant="contained" 
                color="success" 
                onClick={() => setActionModal({ open: true, type: 'changeStatus', vendorId: row.id, oldStatus: row.status, newStatus: 'approved' })}
                disableElevation
              >
                Approve
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                color="error" 
                onClick={() => setActionModal({ open: true, type: 'changeStatus', vendorId: row.id, oldStatus: row.status, newStatus: 'rejected' })}
              >
                Reject
              </Button>
            </>
          ) : (
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => navigate(`/vendors/${row.id}`)}
            >
              View Profile
            </Button>
          )}
        </div>
      )
    }
  ];

 const registeredVendors = vendors.filter(v => v.status === 'pending');
 const approvedVendors = vendors.filter(v => v.status === 'approved');
 const rejectedVendors = vendors.filter(v => v.status === 'rejected');

 const counts = {
 all: vendors.length,
 approved: approvedVendors.length,
 rejected: rejectedVendors.length
 };

 const getTabVendors = () => {
 if (tabValue === 0) return vendors;
 if (tabValue === 1) return approvedVendors;
 return rejectedVendors;
 };

 if (loading) {
 return (
 <Box className="flex items-center justify-center h-[50vh]">
 <CircularProgress />
 </Box>
 );
 }

 return (
 <Box className="pb-8 space-y-6">
 <PageHeader 
 title="Notification Center" 
 breadcrumbs={[
 { label: 'Dashboard', path: '/' },
 { label: 'Notifications' }
 ]} 
 />
 
 <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
 <Tabs 
 value={tabValue} 
 onChange={(e, val) => setTabValue(val)}
 sx={{
 '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '15px' }
 }}
 >
 <Tab label={`All (${counts.all})`} />
 <Tab label={`Approved (${counts.approved})`} />
 <Tab label={`Rejected (${counts.rejected})`} />
 </Tabs>
 </Box>

 <div className="bg-card rounded-card shadow-sm border border-borderLight overflow-hidden">
 <DataTable 
 columns={columns} 
 data={getTabVendors()} 
 />
 </div>

 <ConfirmDialog 
 open={actionModal.open && actionModal.type === 'changeStatus'}
 title="Change Vendor Status"
 message={`Are you sure you want to change vendor status from ${actionModal.oldStatus} to ${actionModal.newStatus}?`}
 requiresReason={actionModal.newStatus === 'rejected'}
 reasonLabel="Reason for rejection"
 reasonValue={rejectionReason}
 onReasonChange={setRejectionReason}
 confirmLabel="Confirm"
 confirmColor="primary"
 onCancel={() => { setActionModal({ open: false, type: '', vendorId: null, oldStatus: '', newStatus: '' }); setRejectionReason(''); }}
 onConfirm={handleAction}
 />
 </Box>
 );
};

export default NotificationCenterPage;

