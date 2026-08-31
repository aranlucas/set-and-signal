import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { i18n } from "@/i18n/i18n";
import { useStore } from "@/app/store/useStore";
import { router } from "@/app/router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  const boot = useStore((state) => state.boot);
  useEffect(() => {
    void boot();
  }, [boot]);
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
