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
  interestRateCurve?: number[] // 持有期间利率曲线（数组长 = holdYears+1，表示年初利率）。优先级高于 interestRate
  loanTermYears?: number // 默认 30
  rentNowPerWeek?: number // "如果租房" 起步周租，默认 700
  rentFrequency?: 'monthly' | 'fortnightly' // 租房 + ETF 节奏，默认 fortnightly
  rentGrowthPct?: number // 默认 3
  etfReturnPct?: number // 默认 7
  appreciationPct?: number // 默认 4
  // Offset 账户
  offsetInitial?: number // 初始 offset 余额（$），默认 0
  offsetMonthly?: number // 每月新增 offset（$），默认 0
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
  // 中间量（用于公式可视化）
  finalOffsetBalance: number
  totalInterestPaid: number
  totalInterestNoOffset: number // 不用 offset 的对照
  rentPathInitial: number // 入场现金 + offset 初始
  rentPathContributions: number // 累积投入 ETF 的差额（不含初始）
  periodsPerYear: number // 26 if fortnightly else 12
  commissionFraction: number
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
  const baseRate =
    inputs.interestRate ?? defaultInterestRate(purpose, depositPct)
  const loanTerm = inputs.loanTermYears ?? 30
  const rentGrowth = (inputs.rentGrowthPct ?? 3) / 100
  // ETF 默认 = 贷款利率（用户假设：自己投资回报 ≈ 银行贷款利率）
  const etfReturn = (inputs.etfReturnPct ?? baseRate) / 100
  const appreciation =
    (propertyData?.suburbAppreciation ?? inputs.appreciationPct ?? 4) / 100

  // 利率曲线：每年一个利率值，长度 = holdYears+1（年 0..holdYears）
  // 如果用户没自定义，就用 baseRate 作平直线
  const rateCurveRaw = inputs.interestRateCurve
  const rateAtYear = (y: number): number => {
    if (!rateCurveRaw || rateCurveRaw.length === 0) return baseRate
    const idx = Math.min(y, rateCurveRaw.length - 1)
    return rateCurveRaw[idx]
  }
  const interestRate = baseRate // 兼容老接口（用于 monthlyMortgage 显示）

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

  // Offset 与节奏
  const offsetInitial = inputs.offsetInitial ?? 0
  const offsetMonthly = inputs.offsetMonthly ?? 0
  const rentFrequency = inputs.rentFrequency ?? 'fortnightly'
  const periodsPerYear = rentFrequency === 'fortnightly' ? 26 : 12

  // 买房路径：含 offset + 可变利率 的月度摊销
  // 修复点：① 利率每年可不同（曲线）② P&I 每年按新利率 + 剩余期重算 ③ offset 月增放在月末 ④ 当月本金超出余额时 → 多余流入 offset（不丢掉）⑤ 输出年度现金流给 rent path 做公平对比
  const simulateBuyPath = (months: number) => {
    let loanBal = loan
    let offsetBal = offsetInitial
    let loanBalNo = loan
    let totalInterest = 0
    let totalInterestNo = 0
    let currentPayment = monthlyPayment(loan, rateAtYear(0), loanTerm)
    let currentPaymentNo = currentPayment
    const monthlyOutflows: number[] = [] // 按月：当月实际现金流出（含 offset 月增）

    for (let m = 1; m <= months; m++) {
      const yearIdx = Math.floor((m - 1) / 12)
      const annualRate = rateAtYear(yearIdx)
      const monthlyRate = annualRate / 100 / 12

      // 每年第一个月：按 (剩余余额, 新利率, 剩余期) 重算 P&I（AU 变利率常态）
      if ((m - 1) % 12 === 0 && m > 1) {
        const yearsLeft = loanTerm - yearIdx
        if (loanBal > 0)
          currentPayment = monthlyPayment(loanBal, annualRate, yearsLeft)
        if (loanBalNo > 0)
          currentPaymentNo = monthlyPayment(loanBalNo, annualRate, yearsLeft)
      }

      // ── 含 offset 版本 ──
      const effectiveLoan = Math.max(0, loanBal - offsetBal)
      const interest = effectiveLoan * monthlyRate
      totalInterest += interest

      let monthCashOut = 0
      if (loanBal > 0) {
        const principalDue = currentPayment - interest
        if (principalDue >= loanBal) {
          // 当月本金超过剩余 → 还清 + 多余进 offset
          const overpay = principalDue - loanBal
          loanBal = 0
          offsetBal += overpay
        } else {
          loanBal -= principalDue
        }
        monthCashOut += currentPayment
      } else {
        // 贷款已还清，月供这部分自由现金 → 进 offset
        offsetBal += currentPayment
        monthCashOut += currentPayment
      }
      // 月末追加 offset 存款（保守：本月利息按月初 offset 算）
      offsetBal += offsetMonthly
      monthCashOut += offsetMonthly
      monthlyOutflows.push(monthCashOut)

      // ── 不含 offset 对照 ──
      const interestNo = loanBalNo * monthlyRate
      totalInterestNo += interestNo
      const principalNo = currentPaymentNo - interestNo
      loanBalNo = Math.max(0, loanBalNo - principalNo)
    }

    return {
      loanBalance: loanBal,
      offsetBalance: offsetBal,
      totalInterestPaid: totalInterest,
      totalInterestNoOffset: totalInterestNo,
      monthlyOutflows,
    }
  }
  const buyAtHold = simulateBuyPath(holdYears * 12)
  const remainingLoan = buyAtHold.loanBalance
  const finalOffsetBalance = buyAtHold.offsetBalance

  // 租房路径资产（fortnightly 或 monthly 节奏）
  // 公平对比：买家月度真实支出（mortgage + holding + offset月增）-> 租家投入 ETF
  const rentNowPerWeek = inputs.rentNowPerWeek ?? 700
  const periodETF = Math.pow(1 + etfReturn, 1 / periodsPerYear) - 1
  const annualRent0 = rentNowPerWeek * 52

  const simulateRentPath = (
    years: number,
    monthlyMortgageOutflows: number[], // 来自 simulateBuyPath
  ) => {
    const periods = Math.round(years * periodsPerYear)
    let assets = upfrontCash + offsetInitial
    let annualRentDyn = annualRent0
    let totalContrib = 0
    // 把月支出转换成按 period 切片：每年一个月度均值，再按 period 分摊
    for (let p = 0; p < periods; p++) {
      const yearIdx = Math.floor(p / periodsPerYear)
      // 该年内 12 个月的实际现金流出均值（mortgage + offsetMonthly）
      let yearOutflowSum = 0
      for (let m = 0; m < 12; m++) {
        const monthIdx = yearIdx * 12 + m
        if (monthIdx < monthlyMortgageOutflows.length) {
          yearOutflowSum += monthlyMortgageOutflows[monthIdx]
        }
      }
      const annualBuyOutflowYear = yearOutflowSum + monthlyHolding * 12 // holding 视为年内均匀
      const periodBuy = annualBuyOutflowYear / periodsPerYear
      const periodRent = annualRentDyn / periodsPerYear
      const periodContrib = periodBuy - periodRent
      assets = assets * (1 + periodETF)
      assets += periodContrib
      totalContrib += periodContrib
      if ((p + 1) % periodsPerYear === 0) {
        annualRentDyn *= 1 + rentGrowth
      }
    }
    return { assets, totalContrib }
  }
  const buyAtHoldOutflows = buyAtHold.monthlyOutflows
  const rentAtHold = simulateRentPath(holdYears, buyAtHoldOutflows)
  const rentPathAssets = rentAtHold.assets

  // Break-even 公式（含 offset）：
  // saleP × (1 - comm%) - flatSellCosts - remainingLoan + offsetBalance = rentPathAssets
  // saleP = (rentPathAssets + remainingLoan - offsetBalance + flatSellCosts) / (1 - comm%)
  const flatSellCosts =
    sellCosts.marketingFee +
    sellCosts.auctioneerFee +
    sellCosts.conveyancing +
    sellCosts.mortgageDischarge +
    sellCosts.staging
  const commissionFraction = sellCosts.agentCommissionPct / 100
  const breakevenSalePrice =
    (rentPathAssets + remainingLoan - finalOffsetBalance + flatSellCosts) /
    (1 - commissionFraction)
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
    finalOffsetBalance,
    totalInterestPaid: buyAtHold.totalInterestPaid,
    totalInterestNoOffset: buyAtHold.totalInterestNoOffset,
    rentPathInitial: upfrontCash + offsetInitial,
    rentPathContributions: rentAtHold.totalContrib,
    periodsPerYear,
    commissionFraction,
  }

  // 年度资产对比（每年 1 个数据点）
  const yearlyComparison: YearlyComparisonPoint[] = []
  for (let y = 0; y <= holdYears; y++) {
    const houseValue = price * Math.pow(1 + appreciation, y)
    const buyAtY = simulateBuyPath(y * 12)
    const rentAtY = simulateRentPath(y, buyAtY.monthlyOutflows)
    const sellCostsAtY = totalSellingCosts(houseValue, sellCosts).total
    const buyEquity =
      houseValue - buyAtY.loanBalance + buyAtY.offsetBalance - sellCostsAtY
    yearlyComparison.push({ year: y, buyEquity, rentAssets: rentAtY.assets })
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
  rentFrequency: 'fortnightly',
  rentGrowthPct: 3,
  // etfReturnPct: undefined → 默认 = 贷款利率（用户假设：自己投资回报 ≈ 银行利率）
  appreciationPct: 4,
  offsetInitial: 0,
  offsetMonthly: 0,
  propertyData: {},
  buyCosts: {},
  sellCosts: {},
}
