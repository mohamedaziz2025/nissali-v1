import { DM_Sans, Poppins } from 'next/font/google';
import Providers from './providers';
import './globals.css';

const poppins = Poppins({ subsets: ['latin'], variable: '--font-poppins', weight: ['500', '600'], display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['400', '500', '700'], display: 'swap' });

export const metadata = {
  title: 'Nissali Pro',
  description: 'Espace des praticiennes et back-office Nissali',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${dmSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
