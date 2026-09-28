import { useEffect, useState } from "react";
import { todayISO } from "@/shared/lib/format";

export function useToday() {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    const update = () => setToday(todayISO());
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return today;
}
