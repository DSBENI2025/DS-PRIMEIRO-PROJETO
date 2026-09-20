import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function getEffectiveWorkingHours(args: {
  businessId: string;
  professionalId: string;
  weekday: number;
}) {
  const supabase = getSupabaseAdmin();

  const { data: professionalHours } = await supabase
    .from("professional_hours")
    .select("opens_at,closes_at,is_closed")
    .eq("professional_id", args.professionalId)
    .eq("weekday", args.weekday)
    .maybeSingle();

  if (professionalHours) {
    return professionalHours;
  }

  const { data: businessHours } = await supabase
    .from("business_hours")
    .select("opens_at,closes_at,is_closed")
    .eq("business_id", args.businessId)
    .eq("weekday", args.weekday)
    .maybeSingle();

  return businessHours || null;
}


export async function isScheduleBlocked(args: {
  businessId: string;
  professionalId: string;
  startTime: string;
  endTime: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("id")
    .eq("business_id", args.businessId)
    .lt("start_time", args.endTime)
    .gt("end_time", args.startTime)
    .or(
      "professional_id.is.null,professional_id.eq." + args.professionalId
    )
    .limit(1);

  if (error) throw error;

  return Boolean(data && data.length > 0);
}
