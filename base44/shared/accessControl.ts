/**
 * Współdzielona kontrola dostępu server-side.
 *
 * Aplikacja przechowuje role i grupy w encji `AllowedUser` (nie na platformowej
 * encji `User`), więc RLS platformowy (`{{user.role}}` = admin/user) nie wystarcza
 * do rozróżnienia advisor / team_leader / group_leader. Cała właściwa logika
 * widoczności (admin = wszystko, group_leader = grupa + zespół, team_leader =
 * zespół, reszta = tylko własne) musi być egzekwowana po stronie serwera — tu.
 *
 * `resolveAccessContext(base44)` zwraca kontekst wywołującego: rolę, group_id
 * i listę emaili, których rekordy wolno mu odczytać. Funkcje raportowe filtrują
 * po tej liście (`author_email` / `created_by` / `assigned_user_email` ∈ visibleEmails).
 *
 * Zachowanie jest zgodne z dotychczasową logiką `listMeetingReports` oraz
 * `getUsersInHierarchy` (deduplikacja, bez zmiany semantyki). Nie blokuje tu
 * kont zablokowanych — wyjątek "raportowanie podczas blokady" jest obsłużony
 * w Layout (BlockedUserScreen), a egzekwowanie blokady zostaje po stronie UI.
 */

export interface AccessContext {
  authenticated: boolean;
  allowed: boolean;          // czy email jest na liście AllowedUser
  user?: any;
  allowedUser?: any;
  email?: string;
  role?: string;            // rola z AllowedUser
  groupId?: string | null;
  visibleEmails: string[];  // emaile, których dane wolno odczytać
  isAdmin: boolean;         // rola === 'admin' (widzi wszystko)
  isLeader: boolean;        // admin | group_leader | team_leader
}

export class AccessDeniedError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
    this.name = "AccessDeniedError";
  }
}

export function findManagedUser(allowedUsers: any[], identifier: string) {
  return allowedUsers.find(
    (u) => u.id === identifier || (u.data?.email || u.email) === identifier,
  );
}

export function resolveGroupId(currentUserData: any, groups: any[]): string | null {
  const directGroupId = currentUserData.data?.group_id || currentUserData.group_id;
  if (directGroupId) return directGroupId;

  const currentUserId = currentUserData.id;
  const currentUserEmail = currentUserData.data?.email || currentUserData.email;
  const group = groups.find((g) => {
    const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
    const legacyLeaderId = g.data?.group_leader_id || g.group_leader_id;
    return (
      leaderIds.includes(currentUserId) ||
      leaderIds.includes(currentUserEmail) ||
      legacyLeaderId === currentUserId ||
      legacyLeaderId === currentUserEmail
    );
  });

  return group?.id || null;
}

/** Paginowane pobranie wszystkich rekordów encji (service-role bezpieczny). */
export async function listAll(entity: any, sort = "-created_date", pageSize = 1000) {
  const results: any[] = [];
  let skip = 0;
  while (true) {
    const batch = await entity.list(sort, pageSize, skip);
    if (!batch?.length) break;
    results.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return results;
}

/**
 * Rozwiązuje kontekst dostępu bieżącego wywołującego.
 * Zwraca { authenticated: false } bez sesji, { allowed: false } bez wpisu w AllowedUser.
 */
export async function resolveAccessContext(base44: any): Promise<AccessContext> {
  const user = await base44.auth.me();
  if (!user) {
    return { authenticated: false, allowed: false, visibleEmails: [], isAdmin: false, isLeader: false };
  }

  const [allowedUsers, groups] = await Promise.all([
    listAll(base44.asServiceRole.entities.AllowedUser),
    listAll(base44.asServiceRole.entities.Group),
  ]);

  const allowedUser = allowedUsers.find(
    (u) => (u.data?.email || u.email) === user.email,
  );

  if (!allowedUser) {
    return {
      authenticated: true,
      allowed: false,
      user,
      email: user.email,
      role: null,
      groupId: null,
      visibleEmails: [user.email],
      isAdmin: false,
      isLeader: false,
    };
  }

  const role = allowedUser.data?.role || allowedUser.role || "user";
  const groupId = resolveGroupId(allowedUser, groups);
  const isAdmin = role === "admin";
  const isLeader = isAdmin || role === "group_leader" || role === "team_leader";

  let visibleEmails: string[] = [user.email];

  if (isAdmin) {
    visibleEmails = allowedUsers.map((u) => u.data?.email || u.email);
  } else if (role === "group_leader") {
    visibleEmails = [user.email];
    if (groupId) {
      allowedUsers.forEach((u) => {
        if ((u.data?.group_id || u.group_id) === groupId) {
          visibleEmails.push(u.data?.email || u.email);
        }
      });
    }
    const managedUsers = allowedUser.data?.managed_users || allowedUser.managed_users || [];
    managedUsers.forEach((identifier: string) => {
      const mu = findManagedUser(allowedUsers, identifier);
      if (mu) {
        visibleEmails.push(mu.data?.email || mu.email);
        const mRole = mu.data?.role || mu.role;
        if (mRole === "team_leader") {
          const teamUsers = mu.data?.managed_users || mu.managed_users || [];
          teamUsers.forEach((tid: string) => {
            const tu = findManagedUser(allowedUsers, tid);
            if (tu) visibleEmails.push(tu.data?.email || tu.email);
          });
        }
      }
    });
  } else if (role === "team_leader") {
    visibleEmails = [user.email];
    const managedUsers = allowedUser.data?.managed_users || allowedUser.managed_users || [];
    managedUsers.forEach((identifier: string) => {
      const mu = findManagedUser(allowedUsers, identifier);
      if (mu) visibleEmails.push(mu.data?.email || mu.email);
    });
  }
  // advisor / hr_admin / serviceman / auditor / test_user => tylko własne

  visibleEmails = [...new Set(visibleEmails.filter(Boolean))];

  return {
    authenticated: true,
    allowed: true,
    user,
    allowedUser,
    email: user.email,
    role,
    groupId,
    visibleEmails,
    isAdmin,
    isLeader,
  };
}

/**
 * Zwraca 401/403 z adnotacją do AppErrorLog przy odmowie dostępu.
 * Używane przez funkcje raportowe, gdy wywołujący nie ma uprawnień.
 */
export async function denyAndLog(
  base44: any,
  reason: string,
  details: Record<string, any> = {},
): Promise<Response> {
  try {
    let email = "anonymous";
    try {
      const u = await base44.auth.me();
      if (u?.email) email = u.email;
    } catch {
      /* brak sesji */
    }
    await base44.asServiceRole.entities.AppErrorLog.create({
      message: `Access denied: ${reason}`,
      user_email: email,
      page_url: details.page_url || "",
      metadata: { reason, ...details },
    });
  } catch {
    /* logowanie nie może zepsuć odmowy */
  }
  const status = reason === "no_session" || reason === "not_authenticated" ? 401 : 403;
  return Response.json({ error: "Access denied", reason }, { status });
}