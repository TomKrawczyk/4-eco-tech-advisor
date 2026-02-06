import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const appId = Deno.env.get("BASE44_APP_ID");

        return Response.json({ 
            appId,
            appUrl: `https://${appId}.base44.app`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});