'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Sparkles, Home, MapPin } from 'lucide-react'
import {
  type Inputs,
  defaultInterestRate,
  estimateWeeklyRent,
  calculateHoldingCosts,
} from '@/lib/calculations'
import { formatCurrency } from '@/lib/utils'

interface Props {
  inputs: Inputs
  onChange: (next: Inputs) => void
}

export default function InputPanel({ inputs, onChange }: Props) {
  const [openProperty, setOpenProperty] = useState(true)
  const [openAdvanced, setOpenAdvanced] = useState(false)
  const [openBuyCosts, setOpenBuyCosts] = useState(false)
  const [openSellCosts, setOpenSellCosts] = useState(false)

  const update = (patch: Partial<Inputs>) => onChange({ ...inputs, ...patch })

  const updateProperty = (
    patch: Partial<NonNullable<Inputs['propertyData']>>,
  ) =>
    onChange({
      ...inputs,
      propertyData: { ...(inputs.propertyData ?? {}), ...patch },
    })

  const updateBuyCosts = (
    patch: Partial<NonNullable<Inputs['buyCosts']>>,
  ) =>
    onChange({
      ...inputs,
      buyCosts: { ...(inputs.buyCosts ?? {}), ...patch },
    })

  const updateSellCosts = (
    patch: Partial<NonNullable<Inputs['sellCosts']>>,
  ) =>
    onChange({
      ...inputs,
      sellCosts: { ...(inputs.sellCosts ?? {}), ...patch },
    })

  const defaultRate = defaultInterestRate(inputs.purpose, inputs.depositPct)
  const propertyData = inputs.propertyData ?? {}
  const defaultRent = estimateWeeklyRent(inputs.price)
  const defaultHolding = calculateHoldingCosts(inputs.price, inputs.purpose)

  const buyCosts = inputs.buyCosts ?? {}
  const sellCosts = inputs.sellCosts ?? {}

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          买房参数
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 房价 */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>房价</Label>
            <span className="text-lg font-semibold">
              {formatCurrency(inputs.price)}
            </span>
          </div>
          <Slider
            min={400000}
            max={2000000}
            step={10000}
            value={[inputs.price]}
            onValueChange={([v]) => update({ price: v })}
          />
          <div className="flex gap-1">
            {[600000, 800000, 1000000, 1200000, 1500000].map((p) => (
              <Button
                key={p}
                variant={inputs.price === p ? 'default' : 'outline'}
                size="sm"
                className="flex-1 px-1 text-xs"
                onClick={() => update({ price: p })}
              >
                ${p / 1000}K
              </Button>
            ))}
          </div>
        </div>

        {/* 首付 */}
        <div className="space-y-2">
          <Label>首付比例</Label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 20].map((p) => (
              <Button
                key={p}
                variant={inputs.depositPct === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => update({ depositPct: p })}
              >
                {p}%
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            首付金额：{formatCurrency(inputs.price * (inputs.depositPct / 100))}
          </p>
        </div>

        {/* 用途 */}
        <div className="space-y-2">
          <Label>用途</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={inputs.purpose === 'owner' ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ purpose: 'owner' })}
            >
              自住
            </Button>
            <Button
              variant={inputs.purpose === 'investment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ purpose: 'investment' })}
            >
              投资
            </Button>
          </div>
        </div>

        {/* 首套 + 新旧 */}
        <div className="space-y-2">
          <Label>买家身份</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={inputs.isFirstHomeBuyer ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ isFirstHomeBuyer: true })}
            >
              首套买家
            </Button>
            <Button
              variant={!inputs.isFirstHomeBuyer ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ isFirstHomeBuyer: false })}
            >
              非首套
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={!inputs.isNewBuild ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ isNewBuild: false })}
            >
              二手房
            </Button>
            <Button
              variant={inputs.isNewBuild ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ isNewBuild: true })}
            >
              新房
            </Button>
          </div>
        </div>

        {/* 持有年限 */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>计划持有</Label>
            <span className="text-sm font-semibold">{inputs.holdYears} 年</span>
          </div>
          <Slider
            min={1}
            max={20}
            step={1}
            value={[inputs.holdYears]}
            onValueChange={([v]) => update({ holdYears: v })}
          />
        </div>

        {/* ──── 具体房产数据（手动输入；未来 agent 自动）──── */}
        <CollapsibleSection
          icon={<MapPin className="h-4 w-4" />}
          title="具体房产数据"
          subtitle="（可选，留空用默认估算）"
          open={openProperty}
          onToggle={() => setOpenProperty(!openProperty)}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">房产链接</Label>
              <Input
                placeholder="realestate.com.au / domain.com.au"
                value={propertyData.listingUrl ?? ''}
                onChange={(e) => updateProperty({ listingUrl: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">房产地址</Label>
              <Input
                placeholder="例：12/45 King St, Newtown NSW 2042"
                value={propertyData.address ?? ''}
                onChange={(e) => updateProperty({ address: e.target.value })}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled
              title="Agent 功能开发中，下一版上线"
            >
              <Sparkles className="mr-2 h-3 w-3" />
              🤖 自动获取数据（开发中）
            </Button>
            <div className="my-3 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              或手动输入
              <div className="h-px flex-1 bg-border" />
            </div>

            <NumberOverrideField
              label="周租金"
              suffix="/周"
              prefix="$"
              defaultValue={defaultRent}
              value={propertyData.rentPerWeek}
              onChange={(v) => updateProperty({ rentPerWeek: v })}
            />
            <NumberOverrideField
              label="Strata"
              suffix="/季"
              prefix="$"
              defaultValue={defaultHolding.strata / 4}
              value={propertyData.strataPerQuarter}
              onChange={(v) => updateProperty({ strataPerQuarter: v })}
            />
            <NumberOverrideField
              label="Council rate"
              suffix="/年"
              prefix="$"
              defaultValue={defaultHolding.council}
              value={propertyData.councilPerYear}
              onChange={(v) => updateProperty({ councilPerYear: v })}
            />
            <NumberOverrideField
              label="水费"
              suffix="/年"
              prefix="$"
              defaultValue={defaultHolding.water}
              value={propertyData.waterPerYear}
              onChange={(v) => updateProperty({ waterPerYear: v })}
            />
            <NumberOverrideField
              label="该 suburb 房价年涨"
              suffix="%"
              defaultValue={inputs.appreciationPct ?? 4}
              value={propertyData.suburbAppreciation}
              onChange={(v) => updateProperty({ suburbAppreciation: v })}
              step={0.1}
            />
          </div>
        </CollapsibleSection>

        {/* ──── 买入费用细化 ──── */}
        <CollapsibleSection
          title="买入费用明细"
          subtitle="（默认覆盖大多数情况）"
          open={openBuyCosts}
          onToggle={() => setOpenBuyCosts(!openBuyCosts)}
        >
          <div className="space-y-3">
            <NumberOverrideField
              label="律师/过户费"
              prefix="$"
              defaultValue={2000}
              value={buyCosts.conveyancing}
              onChange={(v) => updateBuyCosts({ conveyancing: v })}
            />
            <NumberOverrideField
              label="建筑检查"
              prefix="$"
              defaultValue={600}
              value={buyCosts.buildingInspection}
              onChange={(v) => updateBuyCosts({ buildingInspection: v })}
            />
            <NumberOverrideField
              label="Strata report"
              prefix="$"
              defaultValue={300}
              value={buyCosts.strataReport}
              onChange={(v) => updateBuyCosts({ strataReport: v })}
            />
            <NumberOverrideField
              label="贷款申请费"
              prefix="$"
              defaultValue={0}
              value={buyCosts.loanFees}
              onChange={(v) => updateBuyCosts({ loanFees: v })}
            />
            <NumberOverrideField
              label="抵押登记"
              prefix="$"
              defaultValue={380}
              value={buyCosts.mortgageRegistration}
              onChange={(v) => updateBuyCosts({ mortgageRegistration: v })}
            />
            <NumberOverrideField
              label="买家代理费"
              suffix="%"
              defaultValue={0}
              value={buyCosts.buyersAgentPct}
              onChange={(v) => updateBuyCosts({ buyersAgentPct: v })}
              step={0.1}
            />
          </div>
        </CollapsibleSection>

        {/* ──── 卖出费用细化 ──── */}
        <CollapsibleSection
          title="卖出费用明细"
          subtitle="（影响盈亏平衡价）"
          open={openSellCosts}
          onToggle={() => setOpenSellCosts(!openSellCosts)}
        >
          <div className="space-y-3">
            <NumberOverrideField
              label="中介佣金"
              suffix="%"
              defaultValue={2.2}
              value={sellCosts.agentCommissionPct}
              onChange={(v) => updateSellCosts({ agentCommissionPct: v })}
              step={0.1}
            />
            <NumberOverrideField
              label="营销/广告费"
              prefix="$"
              defaultValue={5000}
              value={sellCosts.marketingFee}
              onChange={(v) => updateSellCosts({ marketingFee: v })}
            />
            <NumberOverrideField
              label="拍卖师"
              prefix="$"
              defaultValue={0}
              value={sellCosts.auctioneerFee}
              onChange={(v) => updateSellCosts({ auctioneerFee: v })}
            />
            <NumberOverrideField
              label="卖出律师费"
              prefix="$"
              defaultValue={2000}
              value={sellCosts.conveyancing}
              onChange={(v) => updateSellCosts({ conveyancing: v })}
            />
            <NumberOverrideField
              label="房贷解除"
              prefix="$"
              defaultValue={400}
              value={sellCosts.mortgageDischarge}
              onChange={(v) => updateSellCosts({ mortgageDischarge: v })}
            />
            <NumberOverrideField
              label="软装/staging"
              prefix="$"
              defaultValue={0}
              value={sellCosts.staging}
              onChange={(v) => updateSellCosts({ staging: v })}
            />
          </div>
        </CollapsibleSection>

        {/* ──── 高级假设 ──── */}
        <CollapsibleSection
          title="高级假设"
          subtitle="（利率、租金、ETF）"
          open={openAdvanced}
          onToggle={() => setOpenAdvanced(!openAdvanced)}
        >
          <div className="space-y-3">
            <NumberOverrideField
              label="贷款利率"
              suffix="%"
              defaultValue={defaultRate}
              value={inputs.interestRate}
              onChange={(v) => update({ interestRate: v })}
              step={0.05}
            />
            <NumberOverrideField
              label="对比：现租金"
              suffix="/周"
              prefix="$"
              defaultValue={700}
              value={inputs.rentNowPerWeek}
              onChange={(v) => update({ rentNowPerWeek: v })}
            />
            <NumberOverrideField
              label="租金年涨"
              suffix="%"
              defaultValue={3}
              value={inputs.rentGrowthPct}
              onChange={(v) => update({ rentGrowthPct: v })}
              step={0.5}
            />
            <NumberOverrideField
              label="ETF 年化回报"
              suffix="%"
              defaultValue={7}
              value={inputs.etfReturnPct}
              onChange={(v) => update({ etfReturnPct: v })}
              step={0.5}
            />
            <NumberOverrideField
              label="房价年涨假设"
              suffix="%"
              defaultValue={4}
              value={inputs.appreciationPct}
              onChange={(v) => update({ appreciationPct: v })}
              step={0.5}
            />
          </div>
        </CollapsibleSection>
      </CardContent>
    </Card>
  )
}

function CollapsibleSection({
  icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="-mt-1 flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          {subtitle && (
            <span className="text-xs font-normal text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function NumberOverrideField({
  label,
  prefix,
  suffix,
  defaultValue,
  value,
  onChange,
  step = 1,
}: {
  label: string
  prefix?: string
  suffix?: string
  defaultValue: number
  value: number | undefined
  onChange: (v: number | undefined) => void
  step?: number
}) {
  const isOverride = value !== undefined && value !== null
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {!isOverride && (
          <span className="text-[10px] text-muted-foreground">
            默认 {prefix ?? ''}
            {defaultValue.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
            {suffix ?? ''}
          </span>
        )}
        {isOverride && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] text-blue-600 hover:underline"
          >
            重置默认
          </button>
        )}
      </div>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          placeholder={defaultValue.toString()}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? undefined : Number(v))
          }}
          className={`text-sm ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
