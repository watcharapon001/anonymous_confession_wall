import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Anonymous Confession Wall',
  description: 'Share your secrets anonymously without signing up. Read others\' thoughts, like, comment, and engage in a completely safe, judgment-free zone.',
  openGraph: {
    title: 'Anonymous Confession Wall',
    description: 'A beautiful place to share your secrets and read anonymous confessions.',
    url: 'https://anonymous-confession-wall.vercel.app',
    siteName: 'Anonymous Confession Wall',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544253396-ceb2e67f0f62?q=80&w=2000&auto=format&fit=crop', // Temporary aesthetic abstract image
        width: 1200,
        height: 630,
        alt: 'Dark and anonymous workspace',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anonymous Confession Wall',
    description: 'Share your secrets anonymously without signing up.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 min-h-screen antialiased`}>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 -z-10" />
        {children}
      </body>
    </html>
  );
}
