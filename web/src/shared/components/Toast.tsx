import { Toaster } from "@/shared/ui/sonner";
import { useStore } from "@/app/store/useStore";
export default function Toast() {
  const theme = useStore((state) => (state.appState.theme === "light" ? "light" : "dark"));
  return <Toaster theme={theme} position="bottom-center" />;
}
