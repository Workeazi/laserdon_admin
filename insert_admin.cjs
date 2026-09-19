require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndUpdateAdmin() {
  console.log('Fetching admin user...');
  const { data: existing, error: fetchError } = await supabase
    .from('admins')
    .select('*')
    .eq('email', 'admin@laserdon.com')
    .single();
    
  if (fetchError) {
    console.error('Failed to fetch:', fetchError);
    return;
  }
  
  console.log('Current DB state:', existing);
  
  console.log('Updating password to admin123 and status to active...');
  const { data, error } = await supabase
    .from('admins')
    .update({ password_hash: 'admin123', status: 'active', role: 'master_admin' })
    .eq('email', 'admin@laserdon.com')
    .select();
    
  if (error) {
    console.error('Failed to update:', error);
  } else {
    console.log('Successfully updated admin:', data);
  }
}

checkAndUpdateAdmin();  
