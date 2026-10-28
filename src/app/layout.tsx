import type { Metadata } from "next";
import localFont from "next/font/local"; // 1. Import localFont
import "./globals.css";

// 2. Configure Google Sans pointing to the public directory
const googleSans = localFont({
  src: [
    {
      path: "../../public/fonts/GoogleSans-VariableFont_GRAD,opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-sans", // We replace DM_Sans and take over --font-sans
  display: "swap",
});



export const metadata: Metadata = {
  title: "Shifti - A better way to run healthcare",
  description:
    "Shifti streamlines hospital operations for smarter teams and better care.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 3. Inject the new googleSans variable class here
    <html lang="en" className={googleSans.variable}>
      <body className="font-sans bg-[#CCDBD6] text-[#111110] antialiased">
        {children}
      </body>
    </html>
  );
}
