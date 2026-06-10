import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata = {
  title: "PCA TRACKING",
  description: "Dashboard de gestion des renouvellements",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
