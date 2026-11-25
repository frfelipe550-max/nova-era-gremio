// Configuração pública do Supabase. A publishable key pode ficar no frontend.
// NUNCA coloque aqui uma secret key ou service_role key.
(function () {
  "use strict";
  const SUPABASE_URL = "https://igpditxbzbkcanmjzcuw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1gwTv7t2jHk7WK10WZzRCQ_lSqZBV1X";

  if (!window.supabase?.createClient) {
    console.error("Biblioteca do Supabase não foi carregada.");
    return;
  }

  window.novaEraSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
})();
