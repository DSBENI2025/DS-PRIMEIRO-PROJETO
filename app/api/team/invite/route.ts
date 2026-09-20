import { createHash, randomBytes } from "crypto";
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

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");
    const professionalId =
      typeof body.professionalId === "string" && body.professionalId
        ? body.professionalId
        : null;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    if (!["admin", "professional"].includes(role)) {
      return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
    }

    if (role === "professional" && !professionalId) {
      return NextResponse.json(
        { error: "Selecione o profissional vinculado." },
        { status: 400 }
      );
    }

    if (auth.role === "admin" && role === "admin") {
      return NextResponse.json(
        { error: "Somente o proprietário pode convidar outro administrador." },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (professionalId) {
      const { data: professional } = await supabase
        .from("professionals")
        .select("id")
        .eq("id", professionalId)
        .eq("business_id", auth.business.id)
        .eq("active", true)
        .maybeSingle();

      if (!professional) {
        return NextResponse.json(
          { error: "Profissional não encontrado." },
          { status: 404 }
        );
      }

      const { data: existingProfessionalMember } = await supabase
        .from("business_members")
        .select("id")
        .eq("professional_id", professionalId)
        .eq("active", true)
        .maybeSingle();

      if (existingProfessionalMember) {
        return NextResponse.json(
          { error: "Este profissional já possui acesso." },
          { status: 409 }
        );
      }
    }

    const { data: existingUser } = await supabase
      .from("business_members")
      .select("id,user_id")
      .eq("business_id", auth.business.id)
      .eq("active", true);

    for (const member of existingUser || []) {
      const { data } = await supabase.auth.admin.getUserById(member.user_id);
      if ((data.user?.email || "").toLowerCase() === email) {
        return NextResponse.json(
          { error: "Este e-mail já faz parte da equipe." },
          { status: 409 }
        );
      }
    }

    await supabase
      .from("team_invitations")
      .delete()
      .eq("business_id", auth.business.id)
      .eq("email", email)
      .is("accepted_at", null);

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data: invitation, error } = await supabase
      .from("team_invitations")
      .insert({
        business_id: auth.business.id,
        email,
        role,
        professional_id: role === "professional" ? professionalId : null,
        token_hash: tokenHash,
        invited_by: auth.user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    return NextResponse.json({
      invitationId: invitation.id,
      inviteUrl: appUrl.replace(/\/$/, "") + "/convite/" + token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível criar o convite." },
      { status: 500 }
    );
  }
}
