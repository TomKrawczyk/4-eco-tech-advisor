import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function describe(value, depth = 0) {
  if (depth > 3) return '[max-depth]';
  if (value === null) return null;
  if (typeof value === 'string') {
    return {
      type: 'string',
      length: value.length,
      startsWithYa29: value.startsWith('ya29'),
      preview: value.length <= 12 ? value : `${value.slice(0, 4)}...${value.slice(-4)}`
    };
  }
  if (Array.isArray(value)) return value.slice(0, 5).map(v => describe(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = describe(val, depth + 1);
    }
    return out;
  }
  return { type: typeof value, value };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const output = {};
    try {
      output.getConnection = describe(await base44.asServiceRole.connectors.getConnection('googlesheets'));
    } catch (error) {
      output.getConnectionError = error.message;
    }

    try {
      output.getAccessToken = describe(await base44.asServiceRole.connectors.getAccessToken('googlesheets'));
    } catch (error) {
      output.getAccessTokenError = error.message;
    }

    return Response.json(output);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});