import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
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

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: block } = await supabase
      .from("schedule_blocks")
      .select("id,professional_id")
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (!block) {
      return NextResponse.json(
        { error: "Bloqueio não encontrado." },
        { status: 404 }
      );
    }

    if (
      auth.role === "professional" &&
      block.professional_id !== auth.professionalId
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const { error } = await supabase
      .from("schedule_blocks")
      .delete()
      .eq("id", block.id);

    if (error) throw error;

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível remover o bloqueio." },
      { status: 500 }
    );
  }
}
