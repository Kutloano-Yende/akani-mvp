// Baked in at build time (see next.config.ts). Every deployment gets a new
// value, which is how an open tab knows a newer version exists.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
