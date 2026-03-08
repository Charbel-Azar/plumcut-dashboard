import "./globals.css";
import { RefreshProvider } from "@/context/RefreshContext";
import { ToastProvider } from "@/context/ToastContext";

export const metadata = {
  title: "plumcut Dashboard",
  description: "WhatsApp chatbot admin dashboard",
  icons: {
    icon: "/plumcut-favicon.png?v=2",
    shortcut: "/plumcut-favicon.png?v=2",
    apple: "/plumcut-favicon.png?v=2",
  },
};

const themeInitScript = `
(() => {
  try {
    const savedTheme = window.localStorage.getItem("plumcut-dashboard-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  } catch (error) {
    // Ignore theme initialization errors.
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@100..900&family=Alan+Sans:wght@400;500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <RefreshProvider>
          <ToastProvider>{children}</ToastProvider>
        </RefreshProvider>
      </body>
    </html>
  );
}
