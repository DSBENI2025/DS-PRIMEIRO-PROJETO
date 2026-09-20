import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();

    if (!name || !/^[a-z0-9-]{3,50}$/.test(slug)) {
      return NextResponse.json({ error: "Nome ou link inválido." }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", authData.user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ businessId: existing.id, alreadyExists: true });
    }

    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        owner_id: authData.user.id,
        name,
        slug,
        phone,
      })
      .select("id, slug")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Esse link já está em uso." }, { status: 409 });
      }
      throw error;
    }

    const defaultHours = [1,2,3,4,5].map((weekday) => ({
      business_id: business.id,
      weekday,
      opens_at: "08:00",
      closes_at: "18:00",
      is_closed: false,
    }));

    await supabase.from("business_hours").insert(defaultHours);

    if (authData.user.email) {
      await supabase
        .from("subscriptions")
        .update({
          user_id: authData.user.id,
          business_id: business.id,
          updated_at: new Date().toISOString(),
        })
        .eq("payer_email", authData.user.email);
    }

    return NextResponse.json({ businessId: business.id, slug: business.slug });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao criar negócio." }, { status: 500 });
  }
}
