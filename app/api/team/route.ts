import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const [membersResult, invitationsResult, professionalsResult] =
      await Promise.all([
        supabase
          .from("business_members")
          .select(
            "id,user_id,role,professional_id,active,joined_at,professionals(name)"
          )
          .eq("business_id", auth.business.id)
          .order("created_at"),
        supabase
          .from("team_invitations")
          .select(
            "id,email,role,professional_id,expires_at,accepted_at,created_at,professionals(name)"
          )
          .eq("business_id", auth.business.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("professionals")
          .select("id,name,active")
          .eq("business_id", auth.business.id)
          .eq("active", true)
          .order("name"),
      ]);

    if (membersResult.error) throw membersResult.error;
    if (invitationsResult.error) throw invitationsResult.error;
    if (professionalsResult.error) throw professionalsResult.error;

    const members = await Promise.all(
      (membersResult.data || []).map(async (member) => {
        const { data } = await supabase.auth.admin.getUserById(member.user_id);

        return {
          ...member,
          email: data.user?.email || null,
        };
      })
    );

    const { data: owner } = await supabase.auth.admin.getUserById(
      auth.business.owner_id
    );

    return NextResponse.json({
      currentRole: auth.role,
      owner: {
        email: owner.user?.email || null,
        role: "owner",
      },
      members,
      invitations: invitationsResult.data || [],
      professionals: professionalsResult.data || [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível carregar a equipe." },
      { status: 500 }
    );
  }
}
