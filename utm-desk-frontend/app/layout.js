import './globals.css';
import { Instrument_Sans } from 'next/font/google';
const f = Instrument_Sans({ subsets: ['latin'], variable: '--font-ui' });
export const metadata = { title: 'UTM Desk NoSQL Cloud', description: 'Gestión de incidencias del campus UTM' };
export default function RootLayout({ children }) {
  return <html lang="es" className={f.variable}><body>{children}</body></html>;
}
