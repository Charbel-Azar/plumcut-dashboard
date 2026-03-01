"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRefresh } from "@/context/RefreshContext";
import { useToast } from "@/context/ToastContext";
import styles from "./Sidebar.module.css";

function ChatsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 6.8A2.8 2.8 0 0 1 6.8 4h10.4A2.8 2.8 0 0 1 20 6.8v7.4a2.8 2.8 0 0 1-2.8 2.8H11l-4.1 3v-3H6.8A2.8 2.8 0 0 1 4 14.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.7v2.2M12 19.1v2.2M2.7 12h2.2M19.1 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.5 3.2a8.8 8.8 0 1 0 5.2 15.6A9.2 9.2 0 0 1 15.5 3.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 6v5h-5M4 18v-5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 0-12-3M5 13a7 7 0 0 0 12 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 4.5H7.5A2.5 2.5 0 0 0 5 7v10a2.5 2.5 0 0 0 2.5 2.5H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 8.5 18.5 12 14 15.5M18.5 12H9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="18" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

const navItems = [
  { href: "/chats", label: "Chats", icon: <ChatsIcon /> },
  { href: "/insights", label: "Insights", icon: <DashboardIcon /> },
];

const THEME_STORAGE_KEY = "tia-dashboard-theme";

export default function Sidebar({ onChatsNavClick, unreviewedCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isRefreshing, refresh } = useRefresh();
  const toast = useToast();
  const [theme, setTheme] = useState("light");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", initialTheme);
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (!mobileDrawerOpen) {
      return;
    }

    const handleEsc = (event) => {
      if (String(event.key || "").toLowerCase() === "escape") {
        setMobileDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mobileDrawerOpen]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const handleThemeToggle = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  };

  const toggleLabel = theme === "dark" ? "Light Mode" : "Dark Mode";
  const toggleIcon = theme === "dark" ? <SunIcon /> : <MoonIcon />;
  const refreshLabel = isRefreshing ? "Refreshing..." : "Refresh";

  const handleRefresh = () => {
    try {
      refresh();
      toast.success("Refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setMobileDrawerOpen(false);
    }
  };

  const handleChatsNavClick = (event, href) => {
    if (href !== "/chats" || pathname !== "/chats" || typeof onChatsNavClick !== "function") {
      return;
    }

    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      event.preventDefault();
      onChatsNavClick();
      setMobileDrawerOpen(false);
    }
  };

  const handleLogout = () => {
    setMobileDrawerOpen(false);
    router.push("/");
  };

  const handleThemeClick = () => {
    handleThemeToggle();
    setMobileDrawerOpen(false);
  };

  return (
    <>
      {mobileDrawerOpen && (
        <div
          className={styles.mobileDrawerOverlay}
          onMouseDown={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        >
          <div
            id="mobile-sidebar-drawer"
            className={styles.mobileDrawer}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="More actions"
          >
            <button
              type="button"
              className={styles.mobileDrawerItem}
              onClick={handleRefresh}
              disabled={isRefreshing}
              title={refreshLabel}
            >
              <span className={styles.icon}>
                <RefreshIcon />
              </span>
              <span>{refreshLabel}</span>
            </button>
            <button
              type="button"
              className={styles.mobileDrawerItem}
              onClick={handleThemeClick}
              aria-pressed={theme === "dark"}
              title={toggleLabel}
            >
              <span className={styles.icon}>{toggleIcon}</span>
              <span>{toggleLabel}</span>
            </button>
            <button
              type="button"
              className={`${styles.mobileDrawerItem} ${styles.mobileDrawerDanger}`}
              onClick={handleLogout}
              title="Logout"
            >
              <span className={styles.icon}>
                <LogoutIcon />
              </span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      <aside className={styles.sidebar}>
        <div className={styles.logo}>TIA DIB</div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const showChatsBadge = item.href === "/chats" && unreviewedCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                onClick={(event) => handleChatsNavClick(event, item.href)}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {showChatsBadge && (
                  <span className={styles.badge}>
                    {unreviewedCount > 99 ? "99+" : unreviewedCount}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            title={refreshLabel}
            className={`${styles.navItem} ${styles.navButton} ${styles.refreshButton} ${styles.desktopOnly} ${isRefreshing ? styles.refreshing : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <span className={styles.icon}>
              <RefreshIcon />
            </span>
            <span className={styles.label}>{refreshLabel}</span>
          </button>

          <button
            type="button"
            title={refreshLabel}
            className={`${styles.navItem} ${styles.navButton} ${styles.mobileOnly} ${isRefreshing ? styles.refreshing : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={refreshLabel}
          >
            <span className={styles.icon}>
              <RefreshIcon />
            </span>
            <span className={styles.label}>Refresh</span>
          </button>

          <button
            type="button"
            title={toggleLabel}
            className={`${styles.navItem} ${styles.navButton} ${styles.themeButton} ${styles.desktopOnly} ${theme === "dark" ? styles.themeOn : ""}`}
            onClick={handleThemeToggle}
            aria-pressed={theme === "dark"}
          >
            <span className={styles.icon}>{toggleIcon}</span>
            <span className={styles.label}>{toggleLabel}</span>
          </button>

          <div className={`${styles.navSpacer} ${styles.desktopOnly}`} />

          <button
            type="button"
            title="Logout"
            className={`${styles.navItem} ${styles.navButton} ${styles.logoutButton} ${styles.desktopOnly}`}
            onClick={handleLogout}
          >
            <span className={styles.icon}>
              <LogoutIcon />
            </span>
            <span className={styles.label}>Logout</span>
          </button>

          <button
            type="button"
            title="More"
            className={`${styles.navItem} ${styles.navButton} ${styles.mobileOnly} ${mobileDrawerOpen ? styles.active : ""}`}
            onClick={() => setMobileDrawerOpen((current) => !current)}
            aria-label="More actions"
            aria-expanded={mobileDrawerOpen}
            aria-controls="mobile-sidebar-drawer"
          >
            <span className={styles.icon}>
              <MoreIcon />
            </span>
            <span className={styles.label}>More</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
