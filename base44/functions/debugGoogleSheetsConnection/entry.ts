import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const result = {};

    // 1. service role getAccessToken
    try {
      const t = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
      result.serviceRole_getAccessToken = {
        type: typeof t,
        rawValue: typeof t === 'string' ? t : JSON.stringify(t),
        length: typeof t === 'string' ? t.length : null,
      };
    } catch (e) {
      result.serviceRole_getAccessToken = { error: e.message };
    }

    // 2. service role getConnection
    try {
      const c = await base44.asServiceRole.connectors.getConnection('googlesheets');
      result.serviceRole_getConnection = {
        type: typeof c,
        keys: c && typeof c === 'object' ? Object.keys(c) : null,
        accessTokenType: typeof c?.accessToken,
        accessTokenRaw: typeof c?.accessToken === 'string' ? c.accessToken : JSON.stringify(c?.accessToken),
        accessTokenLength: typeof c?.accessToken === 'string' ? c.accessToken.length : null,
      };
    } catch (e) {
      result.serviceRole_getConnection = { error: e.message };
    }

    // 3. user-scoped getAccessToken
    try {
      const t = await base44.connectors.getAccessToken('googlesheets');
      result.userScope_getAccessToken = {
        type: typeof t,
        rawValue: typeof t === 'string' ? t : JSON.stringify(t),
        length: typeof t === 'string' ? t.length : null,
      };
    } catch (e) {
      result.userScope_getAccessToken = { error: e.message };
    }

    // 4. user-scoped getConnection
    try {
      const c = await base44.connectors.getConnection('googlesheets');
      result.userScope_getConnection = {
        type: typeof c,
        keys: c && typeof c === 'object' ? Object.keys(c) : null,
        accessTokenType: typeof c?.accessToken,
        accessTokenRaw: typeof c?.accessToken === 'string' ? c.accessToken : JSON.stringify(c?.accessToken),
        accessTokenLength: typeof c?.accessToken === 'string' ? c.accessToken.length : null,
      };
    } catch (e) {
      result.userScope_getConnection = { error: e.message };
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});