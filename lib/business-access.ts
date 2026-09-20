import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function businessHasActiveSubscription(
  businessId: string,
  ownerId: string
) {
  const supabase = getSupabaseAdmin();

  const { data: byBusiness } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "authorized")
    .limit(1)
    .maybeSingle();

  if (byBusiness) return true;

  const { data: owner } = await supabase.auth.admin.getUserById(ownerId);
  const email = owner.user?.email;

  if (!email) return false;

  const { data: byEmail } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("payer_email", email)
    .eq("status", "authorized")
    .limit(1)
    .maybeSingle();

  return Boolean(byEmail);
}
