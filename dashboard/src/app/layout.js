import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export const metadata = {
  title: "SubBuddy Dashboard",
  description: "Dashboard de gestion des renouvellements",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="layout-wrapper">
          <Sidebar />

          {/* Main Content Area */}
          <main className="main-content" style={{ padding: 0 }}>
            <Header />
            <div style={{ padding: '32px' }}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
