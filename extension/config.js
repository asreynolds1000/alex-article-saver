// Stash Configuration
// Replace these with your Supabase project details

const CONFIG = {
  // Your Supabase project URL (from Project Settings > API)
  SUPABASE_URL: 'https://lzqjdhldaatefmuivogp.supabase.co',

  // Your Supabase anon/public key (from Project Settings > API)
  SUPABASE_ANON_KEY: 'sb_publishable_GksJCS_44RfkLlvw67Vzwg_o2cGAoeo',

  // Your web app URL (after deploying to Vercel/Netlify)
  WEB_APP_URL: 'https://stash.alexreynolds.com',

  // Your user ID from Supabase (Authentication > Users)
  // For multi-user mode, this can be removed and auth will be required
  USER_ID: 'bcb3efb3-ef8a-4c27-bdb2-d86cd6410a0d',
};

// Don't edit below this line
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
}
