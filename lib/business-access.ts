import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SubscriptionAccess = {
  provider: string;
  next_billing_date: string | null;
};

function grantsAccess(subscription: SubscriptionAccess) {
  if (subscription.provider !== "manual_trial") {
    return true;
  }

  if (!subscription.next_billing_date) {
    return false;
  }

  return new Date(subscription.next_billing_date).getTime() > Date.now();
}

export async function businessHasActiveSubscription(
  businessId: string,
  ownerId: string
) {
  const supabase = getSupabaseAdmin();

  const { data: byBusiness } = await supabase
    .from("subscriptions")
    .select("provider,next_billing_date")
    .eq("business_id", businessId)
    .eq("status", "authorized")
    .order("created_at", { ascending: false })
    .limit(20);

  if ((byBusiness || []).some(grantsAccess)) return true;

  const { data: owner } = await supabase.auth.admin.getUserById(ownerId);
  const email = owner.user?.email;

  if (!email) return false;

  const { data: byEmail } = await supabase
    .from("subscriptions")
    .select("provider,next_billing_date")
    .eq("payer_email", email)
    .eq("status", "authorized")
    .order("created_at", { ascending: false })
    .limit(20);

  return (byEmail || []).some(grantsAccess);
}
