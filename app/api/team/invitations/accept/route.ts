import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { bearerToken } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);

    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: userResult, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userResult.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const inviteToken = String(body.token || "");

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Convite inválido." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(inviteToken)
      .digest("hex");

    const { data: invitation } = await supabase
      .from("team_invitations")
      .select(
        "id,business_id,email,role,professional_id,expires_at,accepted_at"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (
      !invitation ||
      invitation.accepted_at ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "Este convite expirou ou já foi utilizado." },
        { status: 410 }
      );
    }

    const userEmail = (userResult.user.email || "").toLowerCase();

    if (!userEmail || userEmail !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "Entre com a mesma conta de e-mail que recebeu o convite.",
        },
        { status: 403 }
      );
    }

    const { data: ownedBusiness } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userResult.user.id)
      .limit(1)
      .maybeSingle();

    if (ownedBusiness) {
      return NextResponse.json(
        {
          error:
            "Esta conta já é proprietária de outro negócio nesta versão do Agenda Pro.",
        },
        { status: 409 }
      );
    }

    const { error: memberError } = await supabase
      .from("business_members")
      .upsert(
        {
          business_id: invitation.business_id,
          user_id: userResult.user.id,
          role: invitation.role,
          professional_id: invitation.professional_id,
          active: true,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,user_id" }
      );

    if (memberError) throw memberError;

    const { error: inviteError } = await supabase
      .from("team_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .is("accepted_at", null);

    if (inviteError) throw inviteError;

    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível aceitar o convite." },
      { status: 500 }
    );
  }
}
