import type { Release } from "./tour";

// The full "how does this work" walkthrough — offered once to anyone who
// hasn't seen it, whether that's the very first admin or a newly invited
// team member. Distinct from RELEASE (release.ts), which is a changelog
// offered to people already using the app; a first-time viewer gets this
// instead of that (see TourManager). Bump `id` if the workflow changes
// enough to be worth re-touring everyone.
export const ONBOARDING: Release = {
  id: "onboarding-1",
  steps: [
    {
      id: "welcome",
      title: "Welcome to Akani",
      body: "A quick walkthrough of how everything fits together — finding prospects, sending compliant outreach, and tracking leads through to a booked call. Use Next and Back to look around, or Cancel any time — you can replay this later from Settings → Profile.",
    },
    {
      id: "dashboard",
      target: "nav-dashboard",
      openNav: true,
      title: "Your dashboard",
      body: "A snapshot of your pipeline — how many prospects are at each stage, recent activity, and what needs following up.",
    },
    {
      id: "invite",
      path: "/settings/users",
      target: "invite-team",
      roles: ["admin"],
      title: "Bring your team in",
      body: "Invite managers and sales users here. Each role sees what it needs — sales users work their own prospects, managers and admins see everything.",
    },
    {
      id: "discover",
      target: "nav-discover",
      openNav: true,
      title: "Find businesses",
      body: "Search South African companies by industry, location and size, and add promising ones straight to your pipeline.",
    },
    {
      id: "add-prospect",
      path: "/prospects",
      target: "add-prospect",
      title: "Already have a list?",
      body: "Add a prospect one at a time, or upload an Excel file of companies and contacts you already know about — both skip straight to \"Qualified\", ready for a campaign.",
    },
    {
      id: "pipeline",
      target: "nav-pipeline",
      openNav: true,
      title: "Track your pipeline",
      body: "See every prospect moving through the stages — identified, qualified, contacted, won — and move them forward as things progress.",
    },
    {
      id: "templates",
      path: "/campaigns/templates",
      target: "new-template",
      roles: ["admin", "manager"],
      title: "Create a compliant email template",
      body: "Every outreach email should ask permission to keep in touch, with Yes/No buttons — a No is added to the do-not-contact list automatically.",
    },
    {
      id: "campaigns",
      path: "/campaigns",
      target: "new-campaign",
      roles: ["admin", "manager"],
      title: "Send a campaign",
      body: "Pick a template, choose which qualified prospects to include, and send. Replies and bookings are tracked automatically from there.",
    },
    {
      id: "leads",
      target: "nav-leads",
      openNav: true,
      title: "Leads",
      body: "Anyone who says yes becomes a lead — an instant reply, up to three follow-ups, and a link to book a call. It stops the moment they book, reply, or unsubscribe.",
    },
    {
      id: "booking",
      path: "/settings/booking",
      target: "booking-settings",
      roles: ["admin", "manager"],
      title: "Set when calls can be booked",
      body: "Choose your working days and hours so the booking links in your emails only offer times that actually work.",
    },
    {
      id: "wrap-up",
      title: "That's the whole loop",
      body: "Find or add prospects → qualify them → send a compliant campaign → follow up leads → book the call. Replay this anytime from Settings → Profile.",
    },
  ],
};
