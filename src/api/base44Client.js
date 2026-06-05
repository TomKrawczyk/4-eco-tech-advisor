import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { initializeOfflineSupport } from '@/components/offline/offlineSync';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

initializeOfflineSupport(base44);