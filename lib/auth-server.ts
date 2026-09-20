import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type BusinessRole = "owner" | "admin" | "professional";

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

  const { data: ownedBusiness } = await supabase
    .from("businesses")
    .select("id,owner_id,name,slug,timezone")
    .eq("owner_id", data.user.id)
    .limit(1)
    .maybeSingle();

  if (ownedBusiness) {
    return {
      user: data.user,
      business: ownedBusiness,
      role: "owner" as BusinessRole,
      professionalId: null as string | null,
    };
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id,role,professional_id")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id,owner_id,name,slug,timezone")
    .eq("id", membership.business_id)
    .maybeSingle();

  if (!business) return null;

  return {
    user: data.user,
    business,
    role: membership.role as BusinessRole,
    professionalId: membership.professional_id as string | null,
  };
}

export function roleAllowed(
  role: BusinessRole,
  allowed: BusinessRole[]
) {
  return allowed.includes(role);
}
