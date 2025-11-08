console.log('🔐 Loaded key:', process.env.SUPABASE_SERVICE_ROLE_KEY); // Debug

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error('Supabase key is missing! Check your .env file and dotenv config.');
}

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;
