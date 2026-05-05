import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '澳洲首套买房计算器 · Aussie Home Buyer',
  description:
    '为赴澳/在澳华人量身做的买房决策助手：印花税、FHG、FHBAS、月供、买卖费用、8 年盈亏平衡一次算清。',
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
