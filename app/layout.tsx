import type { Metadata } from 'next';
import './globals.css';
import { THEME_STORAGE_KEY } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'FX Risk & Correlation Dashboard',
  description: 'A real-time FX Risk and Correlation Dashboard.',
};

// Runs before first paint so a stored dark preference is applied without the page
// flashing light first. Kept inline and dependency-free for that reason.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-surface text-ink min-h-screen">
        {children}
      </body>
    </html>
  );
}
