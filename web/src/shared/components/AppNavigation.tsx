import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  LayoutDashboard,
  CalendarDays,
  History,
  ChartNoAxesCombined,
  Dumbbell,
  Wrench,
  Settings,
  Play,
  Search,
  Menu,
  X,
  UserRound,
  Moon,
  Sun,
} from "lucide-react";
import { useStore } from "@/app/store/useStore";
import { DEMO } from "@/shared/lib/demo";
import { formatDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

export default function AppNavigation({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const user = useStore((store) => store.user);
  const theme = useStore((store) => store.appState.theme);
  const active = useStore((store) => store.appState.active);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = menuButton.current;
    const panel = sidebar.current;
    panel?.querySelector<HTMLButtonElement>(".nav-close")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
      );
      const first = elements.at(0);
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      opener?.focus();
    };
  }, [open, mobile]);
  const links = [
    { to: "/home", label: t("dashboard.overview", "Overview"), icon: LayoutDashboard },
    { to: "/plan", label: t("dashboard.myProgram", "My program"), icon: CalendarDays },
    { to: "/history", label: t("dashboard.workoutHistory", "Workout history"), icon: History },
    { to: "/stats", label: t("dashboard.progress", "Progress"), icon: ChartNoAxesCombined },
    { to: "/library", label: t("dashboard.exerciseLibrary", "Exercise library"), icon: Dumbbell },
    { to: "/tools", label: t("dashboard.trainingTools", "Training tools"), icon: Wrench },
  ] as const;
  const current =
    links.find((link) => pathname.startsWith(link.to))?.label ??
    (pathname.startsWith("/workout")
      ? t("workout.title", "Workout")
      : t("navigation.settings", "Settings"));
  return (
    <>
      <a
        className="skip-link"
        href="#app"
        onClick={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>("#app")?.focus();
        }}
      >
        {t("dashboard.skipContent", "Skip to content")}
      </a>
      {open && (
        <Button
          variant="plain"
          type="button"
          className="nav-backdrop"
          aria-label={t("common.close", "Close")}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={mobile && !open}
        className={`app-sidebar ${open ? "is-open" : ""}`}
      >
        <Link to="/home" className="app-brand" onClick={() => setOpen(false)}>
          <span className="app-brand-icon">
            <Activity size={26} strokeWidth={2.5} />
          </span>
          <span>
            <strong>Set &amp; Signal</strong>
            <small>{t("dashboard.brandLine", "Your training, in focus.")}</small>
          </span>
        </Link>
        <Button
          variant="plain"
          type="button"
          className="nav-close"
          aria-label={t("common.close", "Close")}
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </Button>
        <nav
          aria-label={t("dashboard.mainNavigation", "Main navigation")}
          className="sidebar-links"
        >
          {links.map(({ to, label, icon: NavIcon }) => (
            <Link
              key={to}
              to={to}
              className={`sidebar-link ${pathname.startsWith(to) ? "is-active" : ""}`}
              aria-current={pathname.startsWith(to) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <NavIcon size={20} />
              <span>{label}</span>
              {pathname.startsWith(to) && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-mantra">
            <Activity size={22} />
            <p>
              {t("dashboard.mantra", "Show up. Put in the work.")}
              <br />
              <strong>{t("dashboard.mantraEnd", "The progress is yours.")}</strong>
            </p>
          </div>
          <Button
            className="w-full text-sm"
            onClick={() => {
              setOpen(false);
              onStart();
            }}
          >
            <Play size={17} fill="currentColor" />
            {active
              ? t("home.resumeWorkout", "Resume workout")
              : t("workout.startWorkout", "Start workout")}
          </Button>
          <Link to="/settings" className="sidebar-link" onClick={() => setOpen(false)}>
            <Settings size={19} />
            {t("navigation.settings", "Settings")}
          </Link>
          <Link to="/settings" className="sidebar-profile" onClick={() => setOpen(false)}>
            <span className="profile-avatar">
              <UserRound size={20} />
            </span>
            <span>
              <strong>{user?.name || t("sync.localProfile", "Local training log")}</strong>
              <small>
                {DEMO
                  ? t("dashboard.exampleProfile", "Demo · example data")
                  : user
                    ? t("dashboard.personalAccount", "Personal account")
                    : t("sync.deviceOnly", "Saved on this device")}
              </small>
            </span>
          </Link>
        </div>
      </aside>
      <header className="app-topbar">
        <div className="topbar-title">
          <Button
            variant="plain"
            type="button"
            ref={menuButton}
            className="topbar-menu"
            aria-label={t("dashboard.openMenu", "Open navigation")}
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </Button>
          <span>{current}</span>
        </div>
        <div className="topbar-actions">
          <Button
            variant="plain"
            type="button"
            className="topbar-search"
            aria-label={t("dashboard.searchExercises", "Search exercises…")}
            onClick={() => void navigate({ to: "/library" })}
          >
            <Search size={17} />
            <span>{t("dashboard.searchExercises", "Search exercises…")}</span>
          </Button>
          <span className="topbar-date">
            <CalendarDays size={17} />
            {formatDate(t, new Date(), { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <Button
            variant="plain"
            type="button"
            className="theme-toggle"
            aria-label={
              theme === "light"
                ? t("dashboard.darkMode", "Switch to dark mode")
                : t("dashboard.lightMode", "Switch to light mode")
            }
            onClick={() =>
              useStore.getState().update((draft) => {
                draft.theme = theme === "light" ? "dark" : "light";
              })
            }
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
        </div>
      </header>
    </>
  );
}
