import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdmins() {
  console.log("Checking with ANON key...");
  const { data: anonData, error: anonError } = await supabase.from('admins').select('*');
  console.log("Anon Data:", anonData ? anonData.length : null, "Anon Error:", anonError);

  console.log("Checking with SERVICE ROLE key...");
  const { data: adminData, error: adminError } = await supabaseAdmin.from('admins').select('*');
  console.log("Admin Data:", adminData ? adminData.length : null, "Admin Error:", adminError);
}

checkAdmins();
