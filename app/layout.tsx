import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Frame } from "@/components/frame";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Learn Anything",
  description:
    "An AI conversation-driven learning assistant: declare a knowledge point and it walks you to mastery, one question at a time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Frame>{children}</Frame>
      </body>
    </html>
  );
}
