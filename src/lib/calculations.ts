// 澳洲首套买房计算器 · 核心计算引擎
// 数据来源（截至 2026 Q1）:
//  - NSW Stamp Duty + FHBAS: revenue.nsw.gov.au
//  - First Home Guarantee: housingaustralia.gov.au (2025-10 大改后)
//  - 利率：自住 95% LVR ~ 5.99%, 自住 80% ~ 5.74%, 投资 80% ~ 6.14%
//  - 卖房成本（NSW 公寓典型）：佣金 2-2.5% + 营销 $4-8K + 律师 $1.5-3K + discharge $300-600

// ─── 类型定义 ──────────────────────────────────────────────

export type Purpose = 'owner' | 'investment'
export type State = 'NSW' | 'VIC' | 'QLD'

/** 用户输入：核心参数 */
export interface Inputs {
  price: number
  depositPct: number // 5 / 10 / 20
  state: State
  purpose: Purpose
  isFirstHomeBuyer: boolean
  isNewBuild: boolean
  holdYears: number
  // 高级假设
  interestRate?: number // 自住默认 5.99%（5%首付）/ 5.74%（>=20%首付）；投资 6.14%
  loanTermYears?: number // 默认 30
  rentNowPerWeek?: number // "如果租房" 起步周租，默认 700
  rentGrowthPct?: number // 默认 3
  etfReturnPct?: number // 默认 7
  appreciationPct?: number // 默认 4
  // 具体房产数据 override（手动；未来 agent 自动填）
  propertyData?: PropertyData
  // 买卖费用 override
  buyCosts?: Partial<BuyCosts>
  sellCosts?: Partial<SellCosts>
}

/** 具体房产数据：手动输入或未来 agent 抓取 */
export interface PropertyData {
  listingUrl?: string
  address?: string
  rentPerWeek?: number // override 默认 yield 估算
  strataPerQuarter?: number // override 默认价位三档
  councilPerYear?: number
  waterPerYear?: number
  suburbAppreciation?: number // override 全局 appreciation 假设
}

/** 买入成本明细 */
export interface BuyCosts {
  conveyancing: number // 律师/过户
  buildingInspection: number // 建筑检查（公寓不需要 pest）
  strataReport: number // 必查
  loanFees: number // 贷款申请+估值（broker 通常 waive）
  mortgageRegistration: number // NSW 固定收费
  buyersAgentPct: number // 买家代理（可选，0 表示不用）
}

/** 卖出成本明细 */
export interface SellCosts {
  agentCommissionPct: number // 中介佣金
  marketingFee: number // 营销/广告
  auctioneerFee: number // 拍卖师（议价不需要）
  conveyancing: number // 律师
  mortgageDischarge: number // 房贷解除
  staging: number // 软装/styling（可选）
}

export const DEFAULT_BUY_COSTS: BuyCosts = {
  conveyancing: 2000,
  buildingInspection: 600,
  strataReport: 300,
  loanFees: 0,
  mortgageRegistration: 380,
  buyersAgentPct: 0,
}

export const DEFAULT_SELL_COSTS: SellCosts = {
  agentCommissionPct: 2.2,
  marketingFee: 5000,
  auctioneerFee: 0,
  conveyancing: 2000,
  mortgageDischarge: 400,
  staging: 0,
}

// ─── NSW 印花税 ─────────────────────────────────────────────

/** NSW 标准印花税梯度（2026 年税率，contracts on/after 2024-02-01） */
export function calculateNSWStampDuty(price: number): number {
  if (price <= 0) return 0
  if (price <= 17000) return Math.max(20, price * 0.0125)
  if (price <= 36000) return 212 + (price - 17000) * 0.015
  if (price <= 97000) return 497 + (price - 36000) * 0.0175
  if (price <= 364000) return 1564 + (price - 97000) * 0.035
  if (price <= 1212000) return 10909 + (price - 364000) * 0.045
  if (price <= 3636000) return 49069 + (price - 1212000) * 0.055
  return 182390 + (price - 3636000) * 0.07
}

/** FHBAS 首套买家减免（NSW） */
export function calculateFHBASReduction(
  price: number,
  isFirstHomeBuyer: boolean,
): { reduction: number; status: 'full' | 'partial' | 'none' } {
  if (!isFirstHomeBuyer) return { reduction: 0, status: 'none' }
  const fullDuty = calculateNSWStampDuty(price)
  if (price <= 800000) return { reduction: fullDuty, status: 'full' }
  if (price < 1000000) {
    // 线性递减
    const factor = (1000000 - price) / 200000
    return { reduction: fullDuty * factor, status: 'partial' }
  }
  return { reduction: 0, status: 'none' }
}

// ─── First Home Guarantee ──────────────────────────────────

/** FHG 房价上限（2025-10 大改后） */
export const FHG_PRICE_CAPS: Record<string, number> = {
  'NSW-Sydney': 1500000,
  'NSW-Other': 800000,
  'VIC-Melbourne': 950000,
  'VIC-Other': 650000,
  'QLD-Brisbane': 1000000,
  'QLD-Other': 700000,
}

export function isEligibleForFHG(
  price: number,
  state: State,
  isFirstHomeBuyer: boolean,
  purpose: Purpose,
  depositPct: number,
): boolean {
  if (!isFirstHomeBuyer) return false
  if (purpose !== 'owner') return false
  if (depositPct < 5 || depositPct >= 20) return false
  const capKey = state === 'NSW' ? 'NSW-Sydney' : `${state}-Other`
  return price <= (FHG_PRICE_CAPS[capKey] ?? 0)
}

/** LMI 估算：95% LVR 自住典型保费（FHG 替代它） */
export function estimateLMI(price: number, depositPct: number): number {
  if (depositPct >= 20) return 0
  const loan = price * (1 - depositPct / 100)
  // 极简估算：95% LVR 约 4.2% of loan, 90% 约 2.5%, 85% 约 1.5%
  let rate = 0
  if (depositPct < 10) rate = 0.042
  else if (depositPct < 15) rate = 0.025
  else rate = 0.015
  return Math.round(loan * rate)
}

// ─── 默认利率 ──────────────────────────────────────────────

export function defaultInterestRate(
  purpose: Purpose,
  depositPct: number,
): number {
  if (purpose === 'investment') return 6.14
  return depositPct < 20 ? 5.99 : 5.74
}

// ─── 月供 ──────────────────────────────────────────────────

export function monthlyPayment(
  loanAmount: number,
  annualRatePct: number,
  termYears: number,
): number {
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  if (r === 0) return loanAmount / n
  return (loanAmount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)
}

/** 还款 N 年后剩余本金 */
export function remainingPrincipal(
  loanAmount: number,
  annualRatePct: number,
  termYears: number,
  yearsElapsed: number,
): number {
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  const k = yearsElapsed * 12
  if (r === 0) return loanAmount * (1 - k / n)
  const factor = (Math.pow(1 + r, n) - Math.pow(1 + r, k)) / (Math.pow(1 + r, n) - 1)
  return loanAmount * factor
}

// ─── 持有成本 ──────────────────────────────────────────────

export interface HoldingCosts {
  strata: number
  council: number
  water: number
  insurance: number
  maintenance: number
  total: number
}

/** 估算 strata 年费（按价位三档） */
function estimateStrataAnnual(price: number): number {
  if (price < 700000) return 4000
  if (price < 1200000) return 6000
  return 9000
}

function estimateCouncilAnnual(price: number): number {
  if (price < 700000) return 1400
  if (price < 1200000) return 1700
  return 2200
}

export function calculateHoldingCosts(
  price: number,
  purpose: Purpose,
  override?: PropertyData,
): HoldingCosts {
  const strata = override?.strataPerQuarter
    ? override.strataPerQuarter * 4
    : estimateStrataAnnual(price)
  const council = override?.councilPerYear ?? estimateCouncilAnnual(price)
  const water = override?.waterPerYear ?? 900
  const insurance = purpose === 'owner' ? 400 : 550 // landlord 比 contents 贵
  const maintenance = price * 0.003 // 公寓内部维修拨备 0.3%/年
  const total = strata + council + water + insurance + maintenance
  return { strata, council, water, insurance, maintenance, total }
}

// ─── 租金收入估算 ──────────────────────────────────────────

/** 默认 yield 估算（按价位） */
function estimateGrossYield(price: number): number {
  if (price < 700000) return 0.052
  if (price < 1000000) return 0.044
  if (price < 1500000) return 0.038
  return 0.032
}

export function estimateWeeklyRent(price: number, override?: PropertyData): number {
  if (override?.rentPerWeek) return override.rentPerWeek
  return Math.round((price * estimateGrossYield(price)) / 52)
}

// ─── 买入成本汇总 ─────────────────────────────────────────

export interface ClosingCostsBreakdown {
  total: number
  conveyancing: number
  buildingInspection: number
  strataReport: number
  loanFees: number
  mortgageRegistration: number
  buyersAgentFee: number
}

export function totalClosingCosts(
  price: number,
  buyCosts: BuyCosts,
): ClosingCostsBreakdown {
  const buyersAgentFee = price * (buyCosts.buyersAgentPct / 100)
  const total =
    buyCosts.conveyancing +
    buyCosts.buildingInspection +
    buyCosts.strataReport +
    buyCosts.loanFees +
    buyCosts.mortgageRegistration +
    buyersAgentFee
  return {
    total,
    conveyancing: buyCosts.conveyancing,
    buildingInspection: buyCosts.buildingInspection,
    strataReport: buyCosts.strataReport,
    loanFees: buyCosts.loanFees,
    mortgageRegistration: buyCosts.mortgageRegistration,
    buyersAgentFee,
  }
}

// ─── 卖出成本汇总 ─────────────────────────────────────────

export interface SellCostsBreakdown {
  total: number
  agentCommission: number
  marketingFee: number
  auctioneerFee: number
  conveyancing: number
  mortgageDischarge: number
  staging: number
}

export function totalSellingCosts(
  salePrice: number,
  sellCosts: SellCosts,
): SellCostsBreakdown {
  const agentCommission = salePrice * (sellCosts.agentCommissionPct / 100)
  const total =
    agentCommission +
    sellCosts.marketingFee +
    sellCosts.auctioneerFee +
    sellCosts.conveyancing +
    sellCosts.mortgageDischarge +
    sellCosts.staging
  return {
    total,
    agentCommission,
    marketingFee: sellCosts.marketingFee,
    auctioneerFee: sellCosts.auctioneerFee,
    conveyancing: sellCosts.conveyancing,
    mortgageDischarge: sellCosts.mortgageDischarge,
    staging: sellCosts.staging,
  }
}

// ─── 主计算函数 ───────────────────────────────────────────

export interface CalculationResult {
  // 入场
  price: number
  deposit: number
  loan: number
  stampDuty: number
  fhbasReduction: number
  fhbasStatus: 'full' | 'partial' | 'none'
  netStampDuty: number
  closingCosts: ClosingCostsBreakdown
  fhgEligible: boolean
  lmi: number
  fhog: number
  upfrontCash: number

  // 月度
  interestRate: number
  monthlyMortgage: number
  holdingCosts: HoldingCosts
  monthlyHolding: number
  monthlyTotal: number
  weeklyRent: number

  // 8年盈亏平衡 / 资产对比
  breakeven: BreakevenResult
  scenarioYears: number
  yearlyComparison: YearlyComparisonPoint[]

  // 政策提示
  flags: PolicyFlag[]
}

export interface PolicyFlag {
  type: 'success' | 'warning' | 'info'
  text: string
}

export interface BreakevenResult {
  rentPathAssets: number
  remainingLoan: number
  breakevenSalePrice: number
  requiredAnnualGrowth: number
  flatSellCosts: number // 不随房价变的卖房成本
  expectedSellCosts: SellCostsBreakdown // @ break-even price
}

export interface YearlyComparisonPoint {
  year: number
  buyEquity: number // 房子估值 - 剩余贷款 - 卖出成本
  rentAssets: number // 同期租房路径累计资产
}

export function calculateAll(inputs: Inputs): CalculationResult {
  const {
    price,
    depositPct,
    state,
    purpose,
    isFirstHomeBuyer,
    isNewBuild,
    holdYears,
    propertyData,
  } = inputs

  // 默认值
  const interestRate =
    inputs.interestRate ?? defaultInterestRate(purpose, depositPct)
  const loanTerm = inputs.loanTermYears ?? 30
  const rentGrowth = (inputs.rentGrowthPct ?? 3) / 100
  const etfReturn = (inputs.etfReturnPct ?? 7) / 100
  const appreciation =
    (propertyData?.suburbAppreciation ?? inputs.appreciationPct ?? 4) / 100

  const buyCosts: BuyCosts = { ...DEFAULT_BUY_COSTS, ...(inputs.buyCosts ?? {}) }
  const sellCosts: SellCosts = {
    ...DEFAULT_SELL_COSTS,
    ...(inputs.sellCosts ?? {}),
  }

  // 入场计算
  const deposit = price * (depositPct / 100)
  const loan = price - deposit
  const stampDuty = calculateNSWStampDuty(price) // 仅 NSW，VIC/QLD 后续接
  const { reduction: fhbasReduction, status: fhbasStatus } =
    calculateFHBASReduction(price, isFirstHomeBuyer)
  const netStampDuty = Math.max(0, stampDuty - fhbasReduction)
  const closingCosts = totalClosingCosts(price, buyCosts)

  const fhgEligible = isEligibleForFHG(
    price,
    state,
    isFirstHomeBuyer,
    purpose,
    depositPct,
  )
  const lmi = fhgEligible ? 0 : estimateLMI(price, depositPct)

  const fhog =
    isFirstHomeBuyer && isNewBuild && price <= 600000 && state === 'NSW'
      ? 10000
      : 0

  const upfrontCash =
    deposit + netStampDuty + closingCosts.total + lmi - fhog

  // 月度
  const monthlyMortgage = monthlyPayment(loan, interestRate, loanTerm)
  const holdingCosts = calculateHoldingCosts(price, purpose, propertyData)
  const monthlyHolding = holdingCosts.total / 12
  const monthlyTotal = monthlyMortgage + monthlyHolding
  const weeklyRent = estimateWeeklyRent(price, propertyData)

  // 持有 N 年后
  const remainingLoan = remainingPrincipal(
    loan,
    interestRate,
    loanTerm,
    holdYears,
  )

  // 租房路径资产
  const rentNowPerWeek = inputs.rentNowPerWeek ?? 700
  const monthlyRentNow = (rentNowPerWeek * 52) / 12
  const monthlyRentSavedVsBuying = monthlyTotal - monthlyRentNow

  // 月度差额 + 入场 cash 全部投 ETF（年化 etfReturn）
  // 月化 ETF 收益率
  const monthlyETF = Math.pow(1 + etfReturn, 1 / 12) - 1
  let rentPathAssets = upfrontCash
  let monthlyRentNowDynamic = monthlyRentNow
  for (let m = 0; m < holdYears * 12; m++) {
    rentPathAssets = rentPathAssets * (1 + monthlyETF)
    // 注意：买房月供超过同期租金的部分，租房者可省下投入 ETF
    const monthlyContribution = monthlyTotal - monthlyRentNowDynamic
    rentPathAssets += monthlyContribution
    // 每 12 个月租金涨一次
    if ((m + 1) % 12 === 0) {
      monthlyRentNowDynamic *= 1 + rentGrowth
    }
  }

  // Break-even 公式：sale - sellCosts(sale) - remainingLoan = rentPathAssets
  // sale × (1 - commissionPct) - flatSellCosts - remainingLoan = rentPathAssets
  // sale = (rentPathAssets + remainingLoan + flatSellCosts) / (1 - commissionPct)
  const flatSellCosts =
    sellCosts.marketingFee +
    sellCosts.auctioneerFee +
    sellCosts.conveyancing +
    sellCosts.mortgageDischarge +
    sellCosts.staging
  const commissionFraction = sellCosts.agentCommissionPct / 100
  const breakevenSalePrice =
    (rentPathAssets + remainingLoan + flatSellCosts) / (1 - commissionFraction)
  const requiredAnnualGrowth =
    Math.pow(breakevenSalePrice / price, 1 / holdYears) - 1
  const expectedSellCostsAtBE = totalSellingCosts(breakevenSalePrice, sellCosts)

  const breakeven: BreakevenResult = {
    rentPathAssets,
    remainingLoan,
    breakevenSalePrice,
    requiredAnnualGrowth: requiredAnnualGrowth * 100,
    flatSellCosts,
    expectedSellCosts: expectedSellCostsAtBE,
  }

  // 年度资产对比（每年 1 个数据点）
  const yearlyComparison: YearlyComparisonPoint[] = []
  for (let y = 0; y <= holdYears; y++) {
    const houseValue = price * Math.pow(1 + appreciation, y)
    const rl = remainingPrincipal(loan, interestRate, loanTerm, y)
    const sellCostsAtY = totalSellingCosts(houseValue, sellCosts).total
    const buyEquity = houseValue - rl - sellCostsAtY

    // 租房路径同期资产（用 ETF 复利累积同期 cash 流）
    let rpa = upfrontCash
    let monthlyRentDyn = monthlyRentNow
    for (let m = 0; m < y * 12; m++) {
      rpa = rpa * (1 + monthlyETF)
      rpa += monthlyTotal - monthlyRentDyn
      if ((m + 1) % 12 === 0) {
        monthlyRentDyn *= 1 + rentGrowth
      }
    }
    yearlyComparison.push({ year: y, buyEquity, rentAssets: rpa })
  }

  // 政策提示
  const flags: PolicyFlag[] = []
  if (fhbasStatus === 'full') {
    flags.push({ type: 'success', text: '✓ FHBAS 全免印花税（≤ $800K）' })
  } else if (fhbasStatus === 'partial') {
    flags.push({
      type: 'success',
      text: `✓ FHBAS 部分减免 ${Math.round((fhbasReduction / stampDuty) * 100)}%`,
    })
  }
  if (fhgEligible) {
    flags.push({
      type: 'success',
      text: `✓ 符合 FHG 资格，省 LMI ≈ $${estimateLMI(price, depositPct).toLocaleString()}`,
    })
  }
  if (fhog > 0) {
    flags.push({ type: 'success', text: `✓ FHOG 新房补助 $10,000` })
  }
  if (price > 790000 && price < 810000 && isFirstHomeBuyer) {
    flags.push({
      type: 'warning',
      text: '⚠️ 接近 $800K 印花税悬崖：超过 $800K 立即从全免掉到 partial concession',
    })
  }
  if (price > 990000 && price < 1010000 && isFirstHomeBuyer) {
    flags.push({
      type: 'warning',
      text: '⚠️ 接近 $1M 悬崖：超过 $1M 完全失去 FHBAS 减免（可能多付 $20K+ 印花税）',
    })
  }
  if (depositPct < 20 && !fhgEligible) {
    flags.push({
      type: 'warning',
      text: `⚠️ 不符合 FHG 资格但首付 < 20%，需付 LMI ≈ $${lmi.toLocaleString()}`,
    })
  }
  if (purpose === 'owner') {
    flags.push({
      type: 'info',
      text: 'ℹ️ FHBAS + FHG 要求结算后 12 个月内入住，连续居住 12 个月',
    })
  }

  return {
    price,
    deposit,
    loan,
    stampDuty,
    fhbasReduction,
    fhbasStatus,
    netStampDuty,
    closingCosts,
    fhgEligible,
    lmi,
    fhog,
    upfrontCash,
    interestRate,
    monthlyMortgage,
    holdingCosts,
    monthlyHolding,
    monthlyTotal,
    weeklyRent,
    breakeven,
    scenarioYears: holdYears,
    yearlyComparison,
    flags,
  }
}

// ─── 默认输入（供 UI 初始化用）────────────────────────────

export const DEFAULT_INPUTS: Inputs = {
  price: 800000,
  depositPct: 5,
  state: 'NSW',
  purpose: 'owner',
  isFirstHomeBuyer: true,
  isNewBuild: false,
  holdYears: 8,
  rentNowPerWeek: 700,
  rentGrowthPct: 3,
  etfReturnPct: 7,
  appreciationPct: 4,
  propertyData: {},
  buyCosts: {},
  sellCosts: {},
}
