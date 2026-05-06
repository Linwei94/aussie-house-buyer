import type { Metadata } from 'next'
import './globals.css'

const SITE_TITLE = '澳洲首套买房计算器 · Aussie Home Buyer'
const SITE_DESC =
  '为赴澳/在澳华人量身做的买房决策助手：印花税、FHG、FHBAS、月供、买卖费用、8 年盈亏平衡一次算清。'
const SITE_URL = 'https://www.taolinwei.com/aussie-house-buyer/'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESC,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESC,
    url: SITE_URL,
    siteName: 'Aussie Home Buyer',
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESC,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
