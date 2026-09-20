import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("mercadopago_integrations")
      .delete()
      .eq("business_id", auth.business.id);

    if (error) throw error;

    await supabase
      .from("businesses")
      .update({
        deposit_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.business.id);

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao desconectar Mercado Pago." },
      { status: 500 }
    );
  }
}
