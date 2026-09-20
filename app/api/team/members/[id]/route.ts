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

    const { data: member } = await supabase
      .from("business_members")
      .select("id,role")
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: "Membro não encontrado." },
        { status: 404 }
      );
    }

    if (auth.role === "admin" && member.role === "admin") {
      return NextResponse.json(
        { error: "Somente o proprietário pode remover um administrador." },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("business_members")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (error) throw error;

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível remover o acesso." },
      { status: 500 }
    );
  }
}
