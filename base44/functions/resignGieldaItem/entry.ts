import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Mapowanie powodu rezygnacji → result w PhoneContactReport
const REASON_TO_RESULT = {
  'Niezainteresowany': 'not_interested',
  'Nie odpowiada': 'no_answer',
  'Błędny numer': 'other',
  'Klient już ma instalację': 'other',
  'Inny': 'other',
  'Klient odwołał spotkanie': 'other',
};

// Rezygnacja z przejętego kontaktu/spotkania z Giełdy:
//  (a) archiwizuje rekord (is_archived=true + powód + timestamp), NIE usuwa,
//  (b) automatycznie tworzy raport (PhoneContactReport / MeetingReport) wg istniejącego wzorca,
//  (c) rekord znika z Giełdy (buildery pomijają is_archived).
// Działa w kontekście zalogowanego usera (respektuje RLS).
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pin_id, entity_name, reason, client_name, client_phone, client_address, meeting_date } = body || {};
    if (!pin_id || !entity_name || !reason) {
      return Response.json({ ok: false, reason: 'Brak danych' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const userName = user.displayName || user.full_name || '';

    // 1. Archiwizuj rekord + zapisz powód rezygnacji
    const archive = {
      is_archived: true,
      archived_at: now,
      archived_by_email: user.email,
      archived_by_name: userName,
      resignation_reason: reason,
      resignation_at: now,
    };
    await base44.entities[entity_name].update(pin_id, archive);

    // 2. Auto-raport (wzorzec jak przy zwykłym raportowaniu rozmowy)
    if (entity_name === 'PhoneContact') {
      await base44.entities.PhoneContactReport.create({
        contact_key: pin_id,
        client_name: client_name || '',
        client_phone: client_phone || '',
        client_address: client_address || '',
        contact_date: today,
        result: REASON_TO_RESULT[reason] || 'other',
        description: `Rezygnacja: ${reason}`,
        next_steps: 'Klient odłożony po rezygnacji.',
        author_name: userName,
        author_email: user.email,
      });
    } else if (entity_name === 'MeetingAssignment') {
      await base44.entities.MeetingReport.create({
        client_name: client_name || '',
        client_address: client_address || '',
        client_phone: client_phone || '',
        meeting_date: meeting_date || today,
        meeting_time: '',
        description: `Rezygnacja: ${reason}`,
        next_steps: 'Spotkanie odwołane po rezygnacji.',
        status: 'cancelled',
        author_name: userName,
        author_email: user.email,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, reason: error?.message || 'Błąd serwera' }, { status: 500 });
  }
}