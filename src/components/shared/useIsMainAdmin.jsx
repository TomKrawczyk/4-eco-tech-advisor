import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Sprawdza na backendzie, czy zalogowany użytkownik to główny administrator
// (email z sekretu MAIN_ADMIN_EMAIL). Tylko on może eksportować dane.
export default function useIsMainAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ["is-main-admin"],
    queryFn: async () => {
      const res = await base44.functions.invoke("isMainAdmin", {});
      return res.data?.is_main_admin === true;
    },
    staleTime: 10 * 60 * 1000,
  });

  return { isMainAdmin: data === true, checkingMainAdmin: isLoading };
}