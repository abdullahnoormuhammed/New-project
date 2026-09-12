/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** The project's publishable ("anon") key. Public by design. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Which board this deployment shows, e.g. "taqwa". */
  readonly VITE_BOARD_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
