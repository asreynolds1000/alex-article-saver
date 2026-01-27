// Stash Configuration
// Copy this file to config.js and fill in your values

const CONFIG = {
  // Your Supabase project URL (from Project Settings > API)
  SUPABASE_URL: 'https://your-project-id.supabase.co',

  // Your Supabase anon/public key (from Project Settings > API)
  SUPABASE_ANON_KEY: 'your-anon-key-here',

  // Your web app URL (after deploying to Vercel/Netlify)
  WEB_APP_URL: 'https://your-stash-app.vercel.app',

  // Your user ID from Supabase (Authentication > Users)
  // For multi-user mode, remove this and require sign-in
  USER_ID: 'your-user-id-here',
};

// Don't edit below this line
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
}
