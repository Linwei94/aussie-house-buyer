'use client'

import { useMemo, useState } from 'react'
import InputPanel from '@/components/InputPanel'
import ResultPanel from '@/components/ResultPanel'
import { DEFAULT_INPUTS, calculateAll, type Inputs } from '@/lib/calculations'

export default function Home() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const result = useMemo(() => calculateAll(inputs), [inputs])

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          🏡 澳洲首套买房计算器
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          为赴澳/在澳华人量身做的买房决策助手 · NSW 印花税 / FHG / FHBAS / 月供 / 8 年盈亏平衡一次算清
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[360px_1fr]">
        <div>
          <InputPanel inputs={inputs} onChange={setInputs} />
        </div>
        <div>
          <ResultPanel result={result} inputs={inputs} onInputsChange={setInputs} />
        </div>
      </div>

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
