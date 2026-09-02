import type { Metadata, Viewport } from "next";
import { Fraunces, Paytone_One, DM_Sans } from "next/font/google";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/hooks/useToast";
import { CookieBanner } from "@/components/common/CookieBanner";
import { GoogleAnalytics } from "@/components/common/GoogleAnalytics";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const paytoneOne = Paytone_One({
  variable: "--font-paytone-one",
  subsets: ["latin"],
  weight: "400",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "2happies (staging-next)",
  description: "2happies.nl Next.js rewrite — staging",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${fraunces.variable} ${paytoneOne.variable} ${dmSans.variable}`}>
      <body>
        <GoogleAnalytics />
        <ToastProvider>
          <AuthProvider>
            {children}
            <CookieBanner />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
