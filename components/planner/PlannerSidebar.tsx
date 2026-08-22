"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  Crosshair,
  FolderKanban,
  ListTodo,
  Target,
  TrendingUp,
} from "lucide-react";
import { plannerPath, type PlannerSection } from "@/app/planner-routes";
import { cn } from "./utils";

export type SidebarGoogleState = "live" | "syncing" | "demo" | "error" | "loading";

type PlannerSidebarProps = {
  inboxCount: number;
  activeSection: PlannerSection;
  showPlannerBlocks: boolean;
  showExternalEvents: boolean;
  hasGoogleIntegration: boolean;
  googleState: SidebarGoogleState;
  googleLabel: string;
  /** Calendar layer toggles only on Calendar route — not on Goal Detail etc. */
  showCalendarLayers?: boolean;
  onTogglePlannerBlocks: () => void;
  onToggleExternalEvents: () => void;
  onGoToday: () => void;
  onGoogleClick: () => void;
};

const NAV: Array<{ id: PlannerSection; label: string; icon: typeof CalendarDays }> = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "goals", label: "Goals", icon: Target },
  { id: "progress", label: "Progress", icon: TrendingUp },
];

export function PlannerSidebar({
  inboxCount,
  activeSection,
  showPlannerBlocks,
  showExternalEvents,
  hasGoogleIntegration,
  googleState,
  googleLabel,
  showCalendarLayers = false,
  onTogglePlannerBlocks,
  onToggleExternalEvents,
  onGoToday,
  onGoogleClick,
}: PlannerSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("pos-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem("pos-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const googleDotClass =
    googleState === "live" ? "ok"
      : googleState === "syncing" || googleState === "loading" ? "syncing"
        : googleState === "error" ? "error"
          : "muted";

  return (
    <aside
      className={cn("pos-sidebar", collapsed && "collapsed")}
      style={{ width: collapsed ? "var(--pos-sidebar-collapsed)" : "var(--pos-sidebar-width)" }}
    >
      <div className={cn("pos-sidebar-brand", collapsed && "collapsed")}>
        {!collapsed ? (
          <>
            <div className="pos-sidebar-brand-mark" aria-hidden="true">
              <CalendarDays size={13} />
            </div>
            <span className="pos-sidebar-brand-name">Personal OS</span>
            <button
              type="button"
              className="pos-sidebar-collapse"
              onClick={toggleCollapse}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={13} />
            </button>
          </>
        ) : (
          <div className="pos-sidebar-brand-mark" aria-hidden="true">
            <CalendarDays size={13} />
          </div>
        )}
      </div>

      <nav className="pos-sidebar-nav" aria-label="Primary navigation">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeSection;
          return (
            <div key={item.id} className="pos-sidebar-nav-item">
              <Link
                href={plannerPath(item.id)}
                scroll={false}
                className={cn("pos-sidebar-link", active && "active", collapsed && "icon-only")}
                title={collapsed ? item.label : undefined}
                onClick={item.id === "calendar" ? onGoToday : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span>{item.label}</span>
                    {item.id === "tasks" && inboxCount > 0 && (
                      <em className="pos-sidebar-badge pos-mono">{inboxCount}</em>
                    )}
                  </>
                )}
              </Link>
              {collapsed && (
                <span className="pos-sidebar-tooltip" role="tooltip">
                  {item.label}
                  {item.id === "tasks" && inboxCount > 0 ? ` (${inboxCount})` : ""}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="pos-sidebar-divider" />

      <div className="pos-sidebar-nav-item">
        <button
          type="button"
          className={cn("pos-sidebar-link", collapsed && "icon-only")}
          onClick={onGoToday}
          title={collapsed ? "Today" : undefined}
        >
          <Crosshair size={16} aria-hidden="true" />
          {!collapsed && <span>Today</span>}
        </button>
        {collapsed && <span className="pos-sidebar-tooltip">Today — jump to calendar</span>}
      </div>

      {!collapsed && (
        <div className="pos-sidebar-hints">
          {[
            ["1–5", "Navigate"],
            ["N / ⌘K", "Quick add"],
            ["/", "Search"],
          ].map(([key, label]) => (
            <div key={key} className="pos-sidebar-hint">
              <span>{label}</span>
              <kbd className="pos-mono">{key}</kbd>
            </div>
          ))}
        </div>
      )}

      <div className="pos-sidebar-spacer" />

      {!collapsed && showCalendarLayers && (
        <div className="pos-sidebar-layers">
          <button
            type="button"
            className={cn("pos-sidebar-layer", showPlannerBlocks && "on")}
            onClick={onTogglePlannerBlocks}
            aria-pressed={showPlannerBlocks}
          >
            <i className="dot personal" />
            <span>Personal OS</span>
          </button>
          <button
            type="button"
            className={cn("pos-sidebar-layer", showExternalEvents && "on")}
            onClick={onToggleExternalEvents}
            aria-pressed={showExternalEvents}
            disabled={!hasGoogleIntegration}
            title={hasGoogleIntegration ? "Toggle Google Calendar events" : "Connect Google Calendar first"}
          >
            <i className="dot google" />
            <span>Google Calendar</span>
          </button>
        </div>
      )}

      {!collapsed ? (
        <button type="button" className="pos-sidebar-gcal" onClick={onGoogleClick}>
          <i className={cn("pos-gcal-dot", googleDotClass)} />
          <span>
            <strong>Google Calendar</strong>
            <em>{googleLabel}</em>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="pos-sidebar-gcal-icon"
          onClick={onGoogleClick}
          title={`Google Calendar — ${googleLabel}`}
          aria-label={`Google Calendar — ${googleLabel}`}
        >
          <i className={cn("pos-gcal-dot", googleDotClass)} />
        </button>
      )}

      {collapsed && (
        <button
          type="button"
          className="pos-sidebar-expand"
          onClick={toggleCollapse}
          aria-label="Expand sidebar"
        >
          <ChevronLeft size={13} style={{ transform: "scaleX(-1)" }} />
        </button>
      )}
    </aside>
  );
}
