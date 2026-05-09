import type { Metadata, Viewport } from "next";
import { FavoriteProvider } from "@/components/favorites-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "3d-house-viewer",
  description: "面向普通买房用户的网页端 3D/VR 看房 MVP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <FavoriteProvider>{children}</FavoriteProvider>
      </body>
    </html>
  );
}
