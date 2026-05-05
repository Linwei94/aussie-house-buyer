'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import type { CalculationResult } from '@/lib/calculations'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Props {
  result: CalculationResult
}

export default function ResultPanel({ result }: Props) {
  return (
    <div className="space-y-4">
      <PolicyFlags result={result} />
      <KeyNumbers result={result} />
      <UpfrontBreakdown result={result} />
      <MonthlyBreakdown result={result} />
      <SellCostsBreakdown result={result} />
      <BreakevenSection result={result} />
      <ComparisonChart result={result} />
    </div>
  )
}

function PolicyFlags({ result }: Props) {
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

function KeyNumbers({ result }: Props) {
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

function UpfrontBreakdown({ result }: Props) {
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

function MonthlyBreakdown({ result }: Props) {
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

function SellCostsBreakdown({ result }: Props) {
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

function BreakevenSection({ result }: Props) {
  const be = result.breakeven
  const appreciate = be.requiredAnnualGrowth
  const sydneyHist = 3.0
  const verdict =
    appreciate < 2
      ? { color: 'text-emerald-600', label: '门槛非常低，达成概率高' }
      : appreciate < 3.5
        ? { color: 'text-emerald-600', label: '低于悉尼公寓 10 年均线，达成概率较高' }
        : appreciate < 5
          ? { color: 'text-amber-600', label: '接近悉尼公寓历史均线，需选好区' }
          : { color: 'text-red-600', label: '高于历史均线，挑战较大' }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {result.scenarioYears} 年后要赚钱，需要房子涨多少
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
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
        <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
          <p>
            假设：租房等价方案 = 现租金 + 月度差额投 ETF（年化 7%）
          </p>
          <p>
            对比终值：买房估值−剩余贷款−卖出成本 ≥ 租房路径资产 ${' '}
            {formatCurrency(be.rentPathAssets)}
          </p>
          <p>
            含中介佣金 + 营销 + 律师 + discharge 等卖出成本（合计估算 {formatCurrency(be.expectedSellCosts.total)}）
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ComparisonChart({ result }: Props) {
  const data = result.yearlyComparison.map((p) => ({
    year: p.year,
    买房净资产: Math.round(p.buyEquity),
    租房路径: Math.round(p.rentAssets),
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">买房 vs 租房 + ETF（资产对比）</CardTitle>
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
          房价按假设的年涨幅复利；租房路径用 ETF 复利计入入场现金 + 每月差额。
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
