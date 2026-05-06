import Link from 'next/link'
import Calculator from '@/components/Calculator'

export default function CalculatorPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        ← 返回所有房产
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          ⚡ 空白计算器
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          自定义所有参数测算 · 不绑定具体房产
        </p>
      </header>
      <Calculator />
    </main>
  )
}
