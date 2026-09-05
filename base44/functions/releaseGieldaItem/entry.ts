import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// "Nie podejmuj\u0119" \u2014 oddanie przej\u0119tego kontaktu/spotkania z powrotem na Gie\u0142d\u0119.
//  (a) atomowy updateMany {id, assigned_user_email: <user>} \u2014 tylko w\u0142a\u015bciciel mo\u017ce odda\u0107,
//  (b) zwalnia rekord: assigned_user_email="", assigned_user_name="",
//      dopisuje email usera do released_by ($addToSet), ustawia released_at + released_reason,
//  (c) rekord wraca na Gie\u0142d\u0119 dla innych, ale buildery pomijaj\u0105 go dla user\u00f3w z released_by.
//  (d) je\u015bli po oddaniu released_by zawiera wszystkich aktywnych handlowc\u00f3w \u2014 loguje ostrze\u017cenie.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pin_id, entity_name, reason } = body || {};
    if (!pin_id || !entity_name) {
      return Response.json({ ok: false, reason: 'Brak pin_id/entity_name' }, { status: 400 });
    }

    const entity = base44.entities[entity_name];
    if (!entity) return Response.json({ ok: false, reason: 'Nieznana encja' }, { status: 400 });

    const now = new Date().toISOString();

    // Atomowe zwolnienie \u2014 tylko je\u015bli rekord jest nadal przypisany do tego usera.
    const filter = { id: pin_id, assigned_user_email: user.email };
    const update = {
      $set: {
        assigned_user_email: '',
        assigned_user_name: '',
        released_at: now,
        released_reason: reason || '',
      },
      $addToSet: { released_by: user.email },
    };

    const res = await entity.updateMany(filter, update);
    const modified = res?.modified_count ?? res?.modifiedCount ?? res?.count ?? 0;
    if (modified < 1) {
      return Response.json({ ok: false, reason: 'Nie mo\u017cna zwolni\u0107 \u2014 rekord nie jest ju\u017c Tw\u00f3j.' });
    }

    // Sprawd\u017a, czy po oddaniu rekord nie jest niewidoczny dla wszystkich aktywnych handlowc\u00f3w.
    // Pobierz zaktualizowany rekord i list\u0119 aktywnych doradc\u00f3w (niezablokowanych).
    try {
      const [updated, allowedUsers] = await Promise.all([
        entity.get(pin_id),
        base44.entities.AllowedUser.list(),
      ]);
      const releasedBy = Array.isArray(updated?.released_by) ? updated.released_by : [];
      const activeEmails = (allowedUsers || [])
        .filter((u) => {
          const role = u.data?.role || u.role;
          const blocked = u.data?.is_blocked || u.is_blocked;
          return ['advisor', 'team_leader', 'group_leader'].includes(role) && !blocked;
        })
        .map((u) => u.data?.email || u.email)
        .filter(Boolean);
      if (activeEmails.length > 0 && activeEmails.every((e) => releasedBy.includes(e))) {
        console.warn(
          `[releaseGieldaItem] Rekord ${pin_id} (${entity_name}) oddany przez wszystkich aktywnych handlowc\u00f3w \u2014 nikt go ju\u017c nie zobaczy na Gie\u0142dzie.`
        );
      }
    } catch (_e) {
      // niekrytyczne \u2014 g\u0142\u00f3wna operacja si\u0119 uda\u0142a
    }

    return Response.json({ ok: true, modified });
  } catch (error) {
    return Response.json({ ok: false, reason: error?.message || 'B\u0142\u0105d serwera' }, { status: 500 });
  }
}