import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 3 * 60 * 1000,  // dane świeże przez 3 minuty – brak re-fetch przy każdym mount
			gcTime: 10 * 60 * 1000,    // cache przez 10 minut
		},
	},
});