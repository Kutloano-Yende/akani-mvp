import type { Release } from "./tour";

// Bump `id` when there is something worth touring; people who haven't seen
// this id are offered the tour once. Steps point at elements by their
// data-tour attribute.
export const RELEASE: Release = {
  id: "2026-09-26",
  steps: [
    {
      id: "intro",
      title: "Akani has been updated",
      body: "There's a new way to follow up with leads, and branded emails that ask permission. Use Next and Back to look around, or Cancel any time.",
    },
    {
      id: "leads",
      target: "nav-leads",
      openNav: true,
      title: "Leads",
      body: "Anyone who gets in touch gets an instant reply, up to three follow-ups, and a link to book a call. The emails stop when they book, reply or unsubscribe.",
    },
    {
      id: "templates",
      path: "/campaigns/templates",
      target: "new-template",
      title: "Ask permission to keep in touch",
      body: "Create a template with Yes and No buttons in an Akani-branded email, and preview it first. A No is added to the do-not-contact list automatically.",
    },
    {
      id: "booking",
      path: "/settings/booking",
      target: "booking-settings",
      roles: ["admin", "manager"],
      title: "Set when calls can be booked",
      body: "Choose your working days and hours. This page also has the form to add to your website so enquiries arrive here.",
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
