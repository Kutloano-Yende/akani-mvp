import type { Release } from "./tour";

// Bump `id` when there is something worth touring; people who haven't seen
// this id are offered the tour once. Steps point at elements by their
// data-tour attribute.
export const RELEASE: Release = {
  id: "2026-09-25",
  steps: [
    {
      id: "intro",
      title: "Akani has been updated",
      body: "Here's a quick tour of what's new. Use Next and Back to move around, or Cancel any time.",
    },
    {
      id: "search",
      target: "search",
      title: "Search everything",
      body: "Find any prospect by company or contact name, from anywhere in the app.",
    },
    {
      id: "alerts",
      target: "notifications",
      title: "Needs-attention alerts",
      body: "The bell shows prospects that need a follow-up. Admins also see POPIA requests that are due.",
    },
    {
      id: "discover",
      target: "nav-discover",
      openNav: true,
      title: "Real business data",
      body: "Discover Businesses now searches real South African companies. Add one to your pipeline to save it.",
    },
    {
      id: "prospects-tools",
      path: "/prospects",
      target: "prospects-toolbar",
      title: "Your prospects, your way",
      body: "Switch between All and Mine, and export the list to CSV.",
    },
    {
      id: "admin",
      target: "nav-settings",
      openNav: true,
      roles: ["admin"],
      title: "Admin tools",
      body: "Users, the suppression list, audit logs and POPIA requests are all in Settings.",
    },
    {
      id: "reopen",
      target: "whats-new",
      openNav: true,
      title: "See this again any time",
      body: "Click What's new here whenever you want to replay this tour.",
    },
  ],
};
