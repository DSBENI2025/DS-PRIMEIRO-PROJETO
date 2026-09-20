import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function getAuthenticatedBusiness(req: NextRequest) {
  const token = bearerToken(req);

  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id,owner_id,name,slug,timezone")
    .eq("owner_id", data.user.id)
    .limit(1)
    .maybeSingle();

  if (!business) return null;

  return {
    user: data.user,
    business,
  };
}
