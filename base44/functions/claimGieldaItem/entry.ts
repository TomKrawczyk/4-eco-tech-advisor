import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Atomic claim: warunkowy updateMany {id, assigned_user_email: null} → modified_count 1 = sukces, 0 = ktoś ubiegł.
// Działa w kontekście zalogowanego usera (respektuje RLS).
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const pinId = body?.pin_id;
    const entityName = body?.entity_name;
    const extra = body?.extra_updates || {};
    if (!pinId || !entityName) {
      return Response.json({ ok: false, reason: 'Brak pin_id/entity_name' }, { status: 400 });
    }

    const entity = base44.entities[entityName];
    if (!entity) return Response.json({ ok: false, reason: 'Nieznana encja' }, { status: 400 });

    const filter = { id: pinId, assigned_user_email: null };
    const update = {
      $set: {
        assigned_user_email: user.email,
        assigned_user_name: user.displayName || user.full_name || '',
        ...extra,
      },
    };

    const res = await entity.updateMany(filter, update);
    const modified = res?.modified_count ?? res?.modifiedCount ?? res?.count ?? 0;
    if (modified >= 1) return Response.json({ ok: true, modified });
    return Response.json({ ok: false, reason: 'Ktoś już podjął ten rekord.' });
  } catch (error) {
    return Response.json({ ok: false, reason: error?.message || 'Błąd serwera' }, { status: 500 });
  }
}