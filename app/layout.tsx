import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SafeBites | Ingredient confidence, at a glance',
  description: 'A calm, clear food safety scanner for everyday decisions.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
