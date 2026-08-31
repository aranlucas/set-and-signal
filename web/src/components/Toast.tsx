import { Toaster } from "./ui/sonner";
import { useStore } from "../store/useStore";
export default function Toast() {
  const theme = useStore((state) => (state.appState.theme === "light" ? "light" : "dark"));
  return <Toaster theme={theme} position="bottom-center" />;
}
