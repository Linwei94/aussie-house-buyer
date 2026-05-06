import Link from 'next/link'
import PropertyCard from '@/components/PropertyCard'
import { getAllProperties } from '@/lib/properties'

export default function Home() {
  const properties = getAllProperties()

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            🏡 澳洲首套买房计算器
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            研究过的房产 · 点击进入个性化计算器
          </p>
        </div>
        <Link
          href="/calculator"
          className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ⚡ 空白计算器
        </Link>
      </header>

      {properties.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-3 text-xs text-muted-foreground">
            {properties.length} 套已研究 · 在 Claude 对话里告诉我新地址我会自动添加
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </>
      )}

      <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
        <p>
          数据基于 2026 Q1 政策与利率水平。仅供参考，不构成财务建议。
          实际签约前请咨询独立 mortgage broker、买家律师与会计师。
        </p>
        <p className="mt-1">
          源代码在{' '}
          <a
            href="https://github.com/linwei94/aussie-house-buyer"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            GitHub
          </a>
          ，欢迎 issue / PR。
        </p>
      </footer>
    </main>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed bg-white p-12 text-center">
      <p className="text-3xl">🏘️</p>
      <p className="mt-3 text-lg font-semibold">还没有研究过的房产</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        在 Claude 对话里告诉我地址或 listing URL，我会用 web search 研究后添加到这里。
      </p>
      <div className="mt-4 inline-block rounded-md bg-slate-50 px-4 py-2 text-left text-xs text-slate-600">
        例如：<code className="ml-1 font-mono">帮我研究 12/45 King St, Newtown</code>
      </div>
      <div className="mt-6">
        <Link
          href="/calculator"
          className="text-sm text-blue-600 hover:underline"
        >
          或先用空白计算器探索 →
        </Link>
      </div>
    </div>
  )
}
