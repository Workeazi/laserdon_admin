const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read .env manually to avoid dotenv dependency issues
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'admins',
  'chats',
  'companies',
  'company_industries',
  'company_services',
  'drawing_requests',
  'industries',
  'job_applications',
  'jobs',
  'messages',
  'payments',
  'quotations',
  'reviews',
  'users',
  'vendors'
];

async function checkDatabase() {
  console.log("=== SUPABASE DATABASE ANALYSIS ===");
  console.log("Using Service Role Key to bypass RLS...\n");
  
  const results = {};
  
  for (const table of tables) {
    // 1. Get exact count
    const { count, error: countError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      if (countError.code === '42P01') {
        // Table doesn't exist
        continue;
      }
      console.log(`[${table}] Error fetching count: ${countError.message}`);
      continue;
    }
    
    // 2. Fetch a single sample row to show data structure if count > 0
    let sampleData = null;
    if (count > 0) {
      const { data, error: dataError } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (!dataError && data && data.length > 0) {
        sampleData = data[0];
      }
    }
    
    results[table] = {
      total_rows: count,
      sample_data: sampleData
    };
  }
  
  // Print results
  const validTables = Object.keys(results);
  console.log(`Found ${validTables.length} tables in the public schema.\n`);
  
  for (const table of validTables) {
    console.log(`--- Table: ${table.toUpperCase()} ---`);
    console.log(`Total Rows: ${results[table].total_rows}`);
    if (results[table].sample_data) {
      console.log(`Sample Data Structure:`);
      // truncate long strings in sample data
      const safeSample = {};
      for (const [k, v] of Object.entries(results[table].sample_data)) {
        if (typeof v === 'string' && v.length > 50) {
          safeSample[k] = v.substring(0, 50) + '...';
        } else {
          safeSample[k] = v;
        }
      }
      console.log(JSON.stringify(safeSample, null, 2));
    }
    console.log('\n');
  }
}

checkDatabase();
