'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  calculateAll,
  type CalculationResult,
  type Inputs,
} from '@/lib/calculations'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Props {
  result: CalculationResult
  inputs: Inputs
  onInputsChange: (next: Inputs) => void
}

export default function ResultPanel({ result, inputs, onInputsChange }: Props) {
  return (
    <div className="space-y-4">
      <PolicyFlags result={result} />
      <KeyNumbers result={result} />
      <UpfrontBreakdown result={result} />
      <MonthlyBreakdown result={result} />
      <SellCostsBreakdown result={result} />
      <BreakevenSection
        result={result}
        inputs={inputs}
        onInputsChange={onInputsChange}
      />
      <ComparisonChart result={result} />
    </div>
  )
}

function PolicyFlags({ result }: { result: CalculationResult }) {
  if (result.flags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {result.flags.map((f, i) => (
        <Badge
          key={i}
          variant={
            f.type === 'success'
              ? 'success'
              : f.type === 'warning'
                ? 'warning'
                : 'secondary'
          }
        >
          {f.text}
        </Badge>
      ))}
    </div>
  )
}

function KeyNumbers({ result }: { result: CalculationResult }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">入场现金</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(result.upfrontCash)}
          </p>
          <p className="text-xs text-muted-foreground">
            首付 + 印花税 + 杂费 {result.lmi > 0 ? '+ LMI' : ''}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">月总支出</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(result.monthlyTotal)}
          </p>
          <p className="text-xs text-muted-foreground">
            月供 {formatCurrency(result.monthlyMortgage)} + 持有{' '}
            {formatCurrency(result.monthlyHolding)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            {result.scenarioYears} 年盈亏平衡价
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {formatCurrency(result.breakeven.breakevenSalePrice)}
          </p>
          <p className="text-xs text-muted-foreground">
            需年涨 {formatPercent(result.breakeven.requiredAnnualGrowth, 2)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function UpfrontBreakdown({ result }: { result: CalculationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">入场成本明细</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <Row
          label="首付"
          value={formatCurrency(result.deposit)}
          note={`${((result.deposit / result.price) * 100).toFixed(0)}% × 房价`}
        />
        <Row
          label="印花税"
          value={formatCurrency(result.netStampDuty)}
          note={
            result.fhbasReduction > 0
              ? `原 ${formatCurrency(result.stampDuty)}, FHBAS 减免 ${formatCurrency(result.fhbasReduction)}`
              : undefined
          }
        />
        <Row
          label="过户费用"
          value={formatCurrency(result.closingCosts.total)}
          note={`律师 + 检查 + strata report + 抵押登记${result.closingCosts.buyersAgentFee > 0 ? ' + 买家代理' : ''}`}
        />
        {result.lmi > 0 && (
          <Row
            label="LMI 贷款保险"
            value={formatCurrency(result.lmi)}
            note="不符合 FHG → 95% LVR 必付"
          />
        )}
        {result.fhog > 0 && (
          <Row
            label="FHOG 补助"
            value={`-${formatCurrency(result.fhog)}`}
            note="新房 ≤ $600K 才能拿"
          />
        )}
        <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
          <span>总入场现金</span>
          <span>{formatCurrency(result.upfrontCash)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function MonthlyBreakdown({ result }: { result: CalculationResult }) {
  const h = result.holdingCosts
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">月度支出明细</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <Row
          label="月供（30 年 P&I）"
          value={formatCurrency(result.monthlyMortgage)}
          note={`贷款 ${formatCurrency(result.loan)} @ ${result.interestRate.toFixed(2)}%`}
        />
        <Row label="Strata（业委会费）" value={formatCurrency(h.strata / 12)} />
        <Row label="Council rate" value={formatCurrency(h.council / 12)} />
        <Row label="水费" value={formatCurrency(h.water / 12)} />
        <Row label="保险" value={formatCurrency(h.insurance / 12)} />
        <Row label="维护拨备" value={formatCurrency(h.maintenance / 12)} />
        <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
          <span>月总支出</span>
          <span>{formatCurrency(result.monthlyTotal)}</span>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          租金估算（投资模式用）：{formatCurrency(result.weeklyRent)}/周
        </p>
      </CardContent>
    </Card>
  )
}

function SellCostsBreakdown({ result }: { result: CalculationResult }) {
  const [open, setOpen] = useState(false)
  const sc = result.breakeven.expectedSellCosts
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between"
        >
          <CardTitle className="text-sm">
            预估卖出成本（@ {result.scenarioYears} 年后）
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {formatCurrency(sc.total)}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-1.5 text-sm">
          <Row
            label="中介佣金"
            value={formatCurrency(sc.agentCommission)}
            note={`@ 卖价 ${formatCurrency(result.breakeven.breakevenSalePrice)}`}
          />
          <Row label="营销/广告费" value={formatCurrency(sc.marketingFee)} />
          {sc.auctioneerFee > 0 && (
            <Row label="拍卖师" value={formatCurrency(sc.auctioneerFee)} />
          )}
          <Row label="卖出律师费" value={formatCurrency(sc.conveyancing)} />
          <Row label="房贷解除" value={formatCurrency(sc.mortgageDischarge)} />
          {sc.staging > 0 && (
            <Row label="软装/staging" value={formatCurrency(sc.staging)} />
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            约占卖价 {((sc.total / result.breakeven.breakevenSalePrice) * 100).toFixed(2)}%。佣金会随卖价线性缩放，营销/律师/discharge 是固定金额。
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function BreakevenSection({
  result,
  inputs,
  onInputsChange,
}: {
  result: CalculationResult
  inputs: Inputs
  onInputsChange: (next: Inputs) => void
}) {
  const be = result.breakeven
  const appreciate = be.requiredAnnualGrowth
  const sydneyHist = 3.0
  const etfRate =
    inputs.etfReturnPct ?? inputs.interestRate ?? result.interestRate
  const rentPerWeek = inputs.rentNowPerWeek ?? 700
  const rentGrowth = inputs.rentGrowthPct ?? 3

  const verdict =
    appreciate < 2
      ? { color: 'text-emerald-600', label: '门槛非常低，达成概率高' }
      : appreciate < 3.5
        ? { color: 'text-emerald-600', label: '低于悉尼公寓 10 年均线，达成概率较高' }
        : appreciate < 5
          ? { color: 'text-amber-600', label: '接近悉尼公寓历史均线，需选好区' }
          : { color: 'text-red-600', label: '高于历史均线，挑战较大' }

  // 敏感性：个人投资回报改成 ±2pp 时，盈亏平衡卖价会怎么变
  const sensitivity = useMemo(() => {
    const lo = calculateAll({ ...inputs, etfReturnPct: Math.max(2, etfRate - 2) })
    const hi = calculateAll({ ...inputs, etfReturnPct: etfRate + 2 })
    return {
      loRate: Math.max(2, etfRate - 2),
      loPrice: lo.breakeven.breakevenSalePrice,
      loGrowth: lo.breakeven.requiredAnnualGrowth,
      hiRate: etfRate + 2,
      hiPrice: hi.breakeven.breakevenSalePrice,
      hiGrowth: hi.breakeven.requiredAnnualGrowth,
    }
  }, [inputs, etfRate])

  const update = (patch: Partial<Inputs>) =>
    onInputsChange({ ...inputs, ...patch })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {result.scenarioYears} 年后买房 vs 租房+个人投资：要赚钱房价需涨多少
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">盈亏平衡卖价</p>
            <p className="text-xl font-bold tracking-tight">
              {formatCurrency(be.breakevenSalePrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">需要的年化涨幅</p>
            <p className={`text-xl font-bold tracking-tight ${verdict.color}`}>
              {formatPercent(appreciate, 2)}
            </p>
            <p className="text-xs text-muted-foreground">
              悉尼公寓 10 年均线 ≈ {sydneyHist}%
            </p>
          </div>
        </div>
        <p className={`pt-1 text-sm ${verdict.color}`}>{verdict.label}</p>

        {/* 内嵌可编辑关键假设 */}
        <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            🎛 关键假设（直接编辑会实时重算）
          </p>
          <div className="grid grid-cols-3 gap-2">
            <InlineNumberField
              label="个人投资 年化"
              suffix="%"
              value={etfRate}
              onChange={(v) => update({ etfReturnPct: v })}
              step={0.5}
              hint="不买房去投资能拿到的回报"
            />
            <InlineNumberField
              label="现租金"
              prefix="$"
              suffix="/周"
              value={rentPerWeek}
              onChange={(v) => update({ rentNowPerWeek: v })}
              step={10}
              hint="不买房需要付的租金"
            />
            <InlineNumberField
              label="租金年涨"
              suffix="%"
              value={rentGrowth}
              onChange={(v) => update({ rentGrowthPct: v })}
              step={0.5}
              hint="预期租金通胀"
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            💡 个人投资回报的敏感性：
            {sensitivity.loRate}% → 平衡 {formatCurrency(sensitivity.loPrice)}（涨 {formatPercent(sensitivity.loGrowth, 2)}）；
            {sensitivity.hiRate}% → 平衡 {formatCurrency(sensitivity.hiPrice)}（涨 {formatPercent(sensitivity.hiGrowth, 2)}）
          </p>
        </div>

        {/* 公式形象化 */}
        <FormulaVisualization result={result} inputs={inputs} />
      </CardContent>
    </Card>
  )
}

function FormulaVisualization({
  result,
  inputs,
}: {
  result: CalculationResult
  inputs: Inputs
}) {
  const [open, setOpen] = useState(false)
  const be = result.breakeven
  const N = result.scenarioYears
  const etfRate =
    inputs.etfReturnPct ?? inputs.interestRate ?? result.interestRate
  const offsetInitial = inputs.offsetInitial ?? 0
  const offsetMonthly = inputs.offsetMonthly ?? 0
  const cadence = (inputs.rentFrequency ?? 'fortnightly') === 'fortnightly' ? '每两周' : '每月'

  const interestSaved = be.totalInterestNoOffset - be.totalInterestPaid

  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold text-muted-foreground">
          📐 计算过程（{open ? '收起' : '点击展开看公式'}）
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-md bg-slate-50 p-3 font-mono text-[11px] leading-relaxed">
          <FormulaBlock
            title={`① 租房+个人投资 ${N} 年后总资产`}
            colored="text-blue-700"
          >
            <FormulaLine>初始本金 = 入场现金 + Offset 初始</FormulaLine>
            <FormulaLine>
              {' '}
              = {formatCurrency(result.upfrontCash)} +{' '}
              {formatCurrency(offsetInitial)} ={' '}
              <strong>{formatCurrency(be.rentPathInitial)}</strong>
            </FormulaLine>
            <FormulaLine>
              每期复利率 = (1 + {etfRate}%)^(1/{be.periodsPerYear}) − 1
            </FormulaLine>
            <FormulaLine>
              每期投入 = ({cadence}买房支出 + offset 月增入) − {cadence}租金
            </FormulaLine>
            <FormulaLine>
              累积投入（{N}年共 {N * be.periodsPerYear} 期）=
              <strong> {formatCurrency(be.rentPathContributions)}</strong>
            </FormulaLine>
            <FormulaLine className="border-t pt-1.5">
              <strong className="text-blue-700">
                租房资产 = 复利后 ≈ {formatCurrency(be.rentPathAssets)}
              </strong>
            </FormulaLine>
          </FormulaBlock>

          <FormulaBlock
            title={`② 买房路径 ${N} 年后状态`}
            colored="text-emerald-700"
          >
            <FormulaLine>每月对每月: 利息按 (贷款余额 − Offset) × 利率/12 计算</FormulaLine>
            <FormulaLine>
              {' '}
              累计利息已付 ={' '}
              <strong>{formatCurrency(be.totalInterestPaid)}</strong>
              {offsetInitial + offsetMonthly > 0 && (
                <>
                  {' '}
                  <span className="text-emerald-700">
                    （比无 offset 省 {formatCurrency(interestSaved)}）
                  </span>
                </>
              )}
            </FormulaLine>
            <FormulaLine>
              剩余贷款 ={' '}
              <strong>{formatCurrency(be.remainingLoan)}</strong>
            </FormulaLine>
            <FormulaLine>
              Offset 余额 = {formatCurrency(offsetInitial)} + {N * 12} 个月 ×{' '}
              {formatCurrency(offsetMonthly)} ={' '}
              <strong>{formatCurrency(be.finalOffsetBalance)}</strong>
            </FormulaLine>
          </FormulaBlock>

          <FormulaBlock title="③ 盈亏平衡卖价（求解）" colored="text-amber-700">
            <FormulaLine>条件：卖房净到手 = 租房资产</FormulaLine>
            <FormulaLine>
              卖价 × (1 − 中介%) − 固定卖出费 − 剩余贷款 + Offset 余额 = 租房资产
            </FormulaLine>
            <FormulaLine className="border-t pt-1.5">
              卖价 = (租房资产 + 剩余贷款 − Offset + 固定卖出费) / (1 − 中介%)
            </FormulaLine>
            <FormulaLine>
              {' '}
              = ({formatCurrency(be.rentPathAssets)} +{' '}
              {formatCurrency(be.remainingLoan)} −{' '}
              {formatCurrency(be.finalOffsetBalance)} +{' '}
              {formatCurrency(be.flatSellCosts)})
            </FormulaLine>
            <FormulaLine>
              {' '}
              ÷ (1 − {(be.commissionFraction * 100).toFixed(1)}%)
            </FormulaLine>
            <FormulaLine className="text-amber-700">
              <strong>= {formatCurrency(be.breakevenSalePrice)}</strong>
            </FormulaLine>
          </FormulaBlock>

          <FormulaBlock title="④ 推导年化涨幅" colored="text-purple-700">
            <FormulaLine>
              年化 = (盈亏平衡价 / 买入价)^(1/{N}) − 1
            </FormulaLine>
            <FormulaLine>
              {' '}
              = ({formatCurrency(be.breakevenSalePrice)} /{' '}
              {formatCurrency(result.price)})^(1/{N}) − 1
            </FormulaLine>
            <FormulaLine className="text-purple-700">
              <strong>= {formatPercent(be.requiredAnnualGrowth, 2)}</strong>
            </FormulaLine>
          </FormulaBlock>
        </div>
      )}
    </div>
  )
}

function FormulaBlock({
  title,
  colored,
  children,
}: {
  title: string
  colored: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className={`mb-1 text-[11px] font-semibold ${colored}`}>{title}</p>
      <div className="space-y-0.5 pl-2">{children}</div>
    </div>
  )
}

function FormulaLine({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`text-[11px] leading-relaxed text-slate-700 ${className ?? ''}`}>
      {children}
    </div>
  )
}

function InlineNumberField({
  label,
  prefix,
  suffix,
  value,
  onChange,
  step = 1,
  hint,
}: {
  label: string
  prefix?: string
  suffix?: string
  value: number
  onChange: (v: number) => void
  step?: number
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          className={`h-8 text-sm tabular-nums ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="text-[9px] leading-tight text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

function ComparisonChart({ result }: { result: CalculationResult }) {
  const data = result.yearlyComparison.map((p) => ({
    year: p.year,
    买房净资产: Math.round(p.buyEquity),
    租房路径: Math.round(p.rentAssets),
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">买房 vs 租房 + 个人投资（资产对比）</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="year"
                tickFormatter={(v) => `${v}年`}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${v / 1000}K`
                }
                stroke="#64748b"
                fontSize={12}
              />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l) => `第 ${l} 年`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="买房净资产"
                stroke="#0f172a"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="租房路径"
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          房价按假设的年涨幅复利；租房路径按个人投资年化回报复利计入入场现金 + 每月差额。
        </p>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex-1">
        <span>{label}</span>
        {note && (
          <span className="ml-2 text-xs text-muted-foreground">{note}</span>
        )}
      </div>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
