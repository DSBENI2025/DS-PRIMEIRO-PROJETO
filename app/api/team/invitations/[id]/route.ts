import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("team_invitations")
      .delete()
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .is("accepted_at", null);

    if (error) throw error;

    return NextResponse.json({ cancelled: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível cancelar o convite." },
      { status: 500 }
    );
  }
}
