import "./globals.css";

export const metadata = {
  title: "PCA TRACKING v2.1.0",
  description: "Dashboard de gestion des renouvellements",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
