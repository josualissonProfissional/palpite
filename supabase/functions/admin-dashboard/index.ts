import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  handleError,
  handleOptions,
  HttpError,
  json,
  requireUser,
} from "../_shared/backend.ts";

const adminEmail = (Deno.env.get("ADMIN_DASHBOARD_EMAIL") ?? "josualisson17@gmail.com").toLowerCase();

type ProfileRow = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  invite_code: string | null;
  created_at: string | null;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
};

function profileName(profile?: ProfileRow | null) {
  return profile?.full_name || profile?.nickname || null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const requester = await requireUser(req, admin);

    if ((requester.email ?? "").toLowerCase() !== adminEmail) {
      throw new HttpError(403, "Acesso permitido apenas ao administrador");
    }

    const [authUsers, profilesResult, groupsResult, membersResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("profiles").select("id, full_name, nickname, avatar_url, created_at"),
      admin.from("groups").select("id, name, slug, description, created_by, invite_code, created_at").order("created_at", { ascending: false }),
      admin.from("group_members").select("group_id, user_id, role, status, joined_at").order("joined_at", { ascending: true }),
    ]);

    if (authUsers.error) throw authUsers.error;
    if (profilesResult.error) throw profilesResult.error;
    if (groupsResult.error) throw groupsResult.error;
    if (membersResult.error) throw membersResult.error;

    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const groups = (groupsResult.data ?? []) as GroupRow[];
    const members = (membersResult.data ?? []) as GroupMemberRow[];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const authUserById = new Map((authUsers.data.users ?? []).map((user) => [user.id, user]));

    const users = (authUsers.data.users ?? []).map((user) => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? null,
        name: profileName(profile),
        full_name: profile?.full_name ?? null,
        nickname: profile?.nickname ?? null,
        avatar_url: profile?.avatar_url ?? null,
        created_at: user.created_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
        password: null,
        password_note: "Nao disponivel: o Supabase armazena hash criptografico, nao a senha original.",
      };
    });

    const membersByGroupId = new Map<string, GroupMemberRow[]>();
    for (const member of members) {
      const current = membersByGroupId.get(member.group_id) ?? [];
      current.push(member);
      membersByGroupId.set(member.group_id, current);
    }

    const groupDetails = groups.map((group) => {
      const creatorAuth = group.created_by ? authUserById.get(group.created_by) : null;
      const creatorProfile = group.created_by ? profileById.get(group.created_by) : null;
      return {
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        invite_code: group.invite_code,
        created_at: group.created_at,
        creator: group.created_by
          ? {
              id: group.created_by,
              email: creatorAuth?.email ?? null,
              name: profileName(creatorProfile),
            }
          : null,
        members: (membersByGroupId.get(group.id) ?? []).map((member) => {
          const memberAuth = authUserById.get(member.user_id);
          const memberProfile = profileById.get(member.user_id);
          return {
            user_id: member.user_id,
            email: memberAuth?.email ?? null,
            name: profileName(memberProfile),
            role: member.role,
            status: member.status,
            joined_at: member.joined_at,
          };
        }),
      };
    });

    return json(200, {
      generated_at: new Date().toISOString(),
      totals: {
        users: users.length,
        groups: groups.length,
      },
      users,
      groups: groupDetails,
    });
  } catch (error) {
    return handleError(error);
  }
});
