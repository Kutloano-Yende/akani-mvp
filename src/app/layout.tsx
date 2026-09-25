import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Akani",
  description: "Sales intelligence for B-BBEE prospecting",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint: if an update reload is in progress, show the
            loading skeleton immediately instead of flashing the page. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=Number(localStorage.getItem("akani:updating"));if(t&&Date.now()-t<30000)document.documentElement.setAttribute("data-updating","1")}catch(e){}',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
