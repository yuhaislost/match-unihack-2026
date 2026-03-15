import "client-only";

import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "";

let singleton: ReturnType<typeof createSSRBrowserClient> | null = null;

export function createBrowserClient() {
  if (singleton) return singleton;
  singleton = createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
  return singleton;
}
