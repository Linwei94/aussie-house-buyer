#!/usr/bin/env node
/**
 * NSW Property Sales Information (PSI) → 3 aggregated JSON files for the calculator.
 *
 * 数据来源：NSW Valuer General free bulk PSI yearly archives (CC 4.0)
 *   URL pattern: https://www.valuergeneral.nsw.gov.au/__psi/yearly/{YEAR}.zip
 *
 * 输出（写入 src/data/）：
 *   1. suburb-stats.json       — by (suburb × propertyType): median + CAGR for 1Y/3Y/5Y/10Y windows
 *   2. building-history.json   — by "{houseNum} {street}, {suburb}" for STRATA buildings with ≥2 sales
 *   3. property-history.json   — by slug for properties with ≥2 sales (repeat-sale CAGR)
 *
 * 解析逻辑参考 House-Of-Geeks/your-property-guide (MIT) 中的 sales-nsw.ts
 *
 * 行格式（B 记录，分号分隔）：
 *   - 2001+ 新格式：col 13 = contract date YYYYMMDD; nature codes R/V/3
 *   - 1990-2000 旧格式：col 10 = dd/mm/yyyy; layout shifted
 *
 * 在 GH Actions 跑（runner 联网 + 装好依赖）：见 .github/workflows/refresh-suburb-stats.yml
 */

import AdmZip from 'adm-zip'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE_DIR = join(ROOT, '.psi-cache')
const OUT_SUBURB = join(ROOT, 'src/data/suburb-stats.json')
const OUT_BUILDING = join(ROOT, 'src/data/building-history.json')
const OUT_PROPERTY = join(ROOT, 'src/data/property-history.json')

const YEARS_BACK = parseInt(process.env.YEARS_BACK ?? '10', 10)
const CURRENT_YEAR = new Date().getFullYear()
const START_YEAR = CURRENT_YEAR - YEARS_BACK + 1
const MIN_PRICE = 50_000
// 1995 后 NSW residential 单笔最贵成交 ~$100M（顶级豪宅）。常见 residential 上限 ~$10M。
// 超过 $10M 几乎全是 commercial strata / 整楼 / 开发地块 — 过滤掉
const MAX_PRICE_OVERALL = 100_000_000
const MAX_PRICE_RESIDENTIAL = 10_000_000
const USER_AGENT =
  'Mozilla/5.0 (compatible; AussieHomeBuyer/1.0; +https://github.com/linwei94/aussie-house-buyer)'

// 2001+ format columns
const COL = {
  DISTRICT: 1,
  PROPERTY_ID: 2,
  SALE_COUNTER: 3,
  UNIT_NUMBER: 6,
  HOUSE_NUMBER: 7,
  STREET_NAME: 8,
  SUBURB: 9,
  POSTCODE: 10,
  AREA: 11,
  AREA_TYPE: 12,
  DATE: 13,
  SETTLE: 14,
  PRICE: 15,
  ZONING: 16,
  NATURE: 17,
  PURPOSE: 18,
  DEALING: 23,
}

// Pre-2001 format columns
const OLD_COL = {
  PROPERTY_ID: 3,
  HOUSE_NUMBER: 6,
  STREET_NAME: 7,
  SUBURB: 8,
  POSTCODE: 9,
  DATE: 10,
  PRICE: 11,
  AREA: 13,
  AREA_TYPE: 14,
  ZONING: 16,
  NATURE: 17,
}

// ─── helpers ───────────────────────────────────────────────────────────────

function parseDate(s) {
  if (!s) return null
  const t = s.trim()
  let y, m, d
  if (t.includes('/')) {
    const parts = t.split('/')
    if (parts.length !== 3) return null
    d = parseInt(parts[0], 10)
    m = parseInt(parts[1], 10) - 1
    y = parseInt(parts[2], 10)
  } else {
    if (t.length < 8) return null
    y = parseInt(t.slice(0, 4), 10)
    m = parseInt(t.slice(4, 6), 10) - 1
    d = parseInt(t.slice(6, 8), 10)
  }
  const dt = new Date(Date.UTC(y, m, d))
  return Number.isFinite(dt.getTime()) ? dt : null
}

function titleCase(s) {
  return s.toLowerCase().replace(/(?:^|\s|-|')\S/g, (c) => c.toUpperCase())
}

function median(nums) {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m]
}

function slugifyAddress({ unit, houseNum, street, suburb }) {
  const head = unit ? `${unit}-${houseNum}` : houseNum
  return `${head}-${street}-${suburb}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── download ──────────────────────────────────────────────────────────────

async function downloadYearZip(year) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
  const cachePath = join(CACHE_DIR, `${year}.zip`)
  if (existsSync(cachePath)) {
    const buf = readFileSync(cachePath)
    console.log(`  ${year}: cached (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
    return buf
  }
  const url = `https://www.valuergeneral.nsw.gov.au/__psi/yearly/${year}.zip`
  console.log(`  ${year}: GET ${url}`)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(cachePath, buf)
  console.log(`  ${year}: downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
  return buf
}

// ─── parse one DAT chunk ───────────────────────────────────────────────────

function parseDatLines(text, year, allSales) {
  let count = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('B;')) continue
    const cols = line.split(';')
    if (cols.length < 18) continue

    const isOld = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(
      cols[OLD_COL.DATE]?.trim() ?? '',
    )
    const dateRaw = isOld ? cols[OLD_COL.DATE] : cols[COL.DATE]
    const priceRaw = isOld ? cols[OLD_COL.PRICE] : cols[COL.PRICE]

    const price = parseInt(priceRaw?.replace(/,/g, '') ?? '', 10)
    if (!price || price < MIN_PRICE || price > MAX_PRICE_OVERALL) continue

    const date = parseDate(dateRaw?.trim() ?? '')
    if (!date || date.getUTCFullYear() !== year) continue

    const suburb = (isOld ? cols[OLD_COL.SUBURB] : cols[COL.SUBURB])?.trim()
    const postcode = (isOld ? cols[OLD_COL.POSTCODE] : cols[COL.POSTCODE])?.trim()
    if (!suburb || !postcode) continue

    const nature = (
      isOld ? cols[OLD_COL.NATURE] : cols[COL.NATURE]
    )
      ?.trim()
      .toUpperCase() ?? ''

    // Filter to residential 性质（R = 非 strata 住宅；3 = strata）
    // NOTE: NSW VG 的 R/3 区分不可靠 — 很多 strata 公寓被标 R。所以下面用 unit 区分公寓 vs 房屋
    if (nature !== 'R' && nature !== '3') continue

    // Residential 价格上限过滤：超过 $10M 几乎全是 commercial strata、整栋楼、地块
    if (price > MAX_PRICE_RESIDENTIAL) continue

    const district = cols[COL.DISTRICT]?.trim() ?? ''
    const propId = (isOld ? cols[OLD_COL.PROPERTY_ID] : cols[COL.PROPERTY_ID])?.trim() ?? ''
    const unit = isOld ? '' : (cols[COL.UNIT_NUMBER]?.trim() ?? '')
    const houseNum = (isOld ? cols[OLD_COL.HOUSE_NUMBER] : cols[COL.HOUSE_NUMBER])?.trim() ?? ''
    const street = (isOld ? cols[OLD_COL.STREET_NAME] : cols[COL.STREET_NAME])?.trim() ?? ''

    if (!district || !propId || !houseNum || !street) continue

    // 用 unit number 判断公寓 vs 房屋（比 nature code 更可靠）
    // 有 unit 编号 = STRATA（公寓/单元），没有 = RESIDENCE（独立屋/联排）
    const propertyType = unit ? 'STRATA' : 'RESIDENCE'

    // primary purpose 过滤（2001+ 格式才有）：仅保留 residential 用途
    if (!isOld) {
      const purpose = cols[COL.PURPOSE]?.trim().toUpperCase() ?? ''
      const okPurpose =
        !purpose ||
        purpose.includes('RESID') ||
        purpose.includes('STRATA') ||
        purpose.includes('TOWNHOUSE') ||
        purpose.includes('FLAT') ||
        purpose.includes('UNIT') ||
        purpose.includes('DUPLEX') ||
        purpose.includes('HOUSE')
      if (!okPurpose) continue
    }

    allSales.push({
      district,
      propertyId: propId,
      unit: unit || null,
      houseNum,
      street: titleCase(street),
      suburb: titleCase(suburb),
      postcode,
      date: date.toISOString().slice(0, 10),
      price,
      propertyType,
    })
    count++
  }
  return count
}

// ─── load one year ─────────────────────────────────────────────────────────

async function processYear(year, allSales) {
  let buf
  try {
    buf = await downloadYearZip(year)
  } catch (e) {
    console.error(`  ${year}: skipped (${e.message})`)
    return
  }

  const outerZip = new AdmZip(buf)
  const outerEntries = outerZip.getEntries()
  const innerZips = outerEntries.filter((e) =>
    e.entryName.toLowerCase().endsWith('.zip'),
  )
  const directDats = outerEntries.filter((e) =>
    e.entryName.toUpperCase().endsWith('.DAT'),
  )

  const layout = innerZips.length > directDats.length ? 'weekly-zip' : 'flat-dat'
  let count = 0

  if (layout === 'weekly-zip') {
    for (const e of innerZips) {
      const innerBuf = outerZip.readFile(e)
      if (!innerBuf) continue
      const innerZip = new AdmZip(innerBuf)
      for (const ie of innerZip.getEntries()) {
        if (!ie.entryName.toUpperCase().endsWith('.DAT')) continue
        count += parseDatLines(innerZip.readAsText(ie, 'utf8'), year, allSales)
      }
    }
  } else {
    for (const e of directDats) {
      count += parseDatLines(outerZip.readAsText(e, 'utf8'), year, allSales)
    }
  }
  console.log(`  ${year}: parsed ${count.toLocaleString()} sales`)
}

// ─── aggregate: by suburb × propertyType ───────────────────────────────────

function aggregateBySuburb(sales) {
  const buckets = new Map()
  const now = Date.now()

  for (const s of sales) {
    const yearsAgo = (now - new Date(s.date).getTime()) / (365.25 * 86_400_000)
    const key = `${s.suburb}|${s.propertyType}`
    let arr = buckets.get(key)
    if (!arr) {
      arr = []
      buckets.set(key, arr)
    }
    arr.push({ s, yearsAgo })
  }

  const result = {}
  const wins = [1, 3, 5, 10]

  for (const [key, items] of buckets) {
    const [suburb, type] = key.split('|')
    items.sort((a, b) => a.s.date.localeCompare(b.s.date))

    const stats = { median: {}, cagr: {}, count: {}, lastSold: [] }
    const recent = items.filter((x) => x.yearsAgo <= 1).map((x) => x.s.price)

    for (const w of wins) {
      const window = items.filter((x) => x.yearsAgo <= w).map((x) => x.s.price)
      if (window.length < 5) continue
      stats.median[`${w}y`] = median(window)
      stats.count[`${w}y`] = window.length

      const olderRef = items
        .filter((x) => x.yearsAgo >= w - 0.5 && x.yearsAgo <= w + 0.5)
        .map((x) => x.s.price)
      if (recent.length >= 5 && olderRef.length >= 5) {
        const r = median(recent)
        const o = median(olderRef)
        if (r && o && o > 0) {
          stats.cagr[`${w}y`] = +(Math.pow(r / o, 1 / w) - 1).toFixed(4)
        }
      }
    }
    stats.lastSold = items
      .slice(-10)
      .reverse()
      .map((x) => ({
        address: x.s.unit
          ? `${x.s.unit}/${x.s.houseNum} ${x.s.street}`
          : `${x.s.houseNum} ${x.s.street}`,
        price: x.s.price,
        date: x.s.date,
      }))

    if (!result[suburb]) result[suburb] = {}
    result[suburb][type] = stats
  }
  return result
}

// ─── aggregate: by building (STRATA only, ≥2 sales) ────────────────────────

function aggregateByBuilding(sales) {
  const groups = new Map()
  for (const s of sales) {
    if (s.propertyType !== 'STRATA') continue
    const key = `${s.houseNum} ${s.street}, ${s.suburb}`
    let arr = groups.get(key)
    if (!arr) {
      arr = []
      groups.set(key, arr)
    }
    arr.push(s)
  }

  const result = {}
  for (const [key, items] of groups) {
    if (items.length < 2) continue
    items.sort((a, b) => a.date.localeCompare(b.date))

    const unitsSet = new Set(items.map((s) => s.unit).filter(Boolean))
    const sales12 = items
      .slice(-12)
      .reverse()
      .map((s) => ({ unit: s.unit, price: s.price, date: s.date }))

    // CAGR using ~1y vs ~5y comparison if data spans 4+ years
    const latest = new Date(items[items.length - 1].date).getTime()
    const earliest = new Date(items[0].date).getTime()
    const span = (latest - earliest) / (365.25 * 86_400_000)

    let cagrBy = {}
    if (span >= 4) {
      const newP = median(
        items
          .filter(
            (s) =>
              (latest - new Date(s.date).getTime()) / (365.25 * 86_400_000) <=
              1.5,
          )
          .map((s) => s.price),
      )
      const oldP = median(
        items
          .filter((s) => {
            const yr = (latest - new Date(s.date).getTime()) / (365.25 * 86_400_000)
            return yr >= Math.max(span - 1, 4) && yr <= span
          })
          .map((s) => s.price),
      )
      if (newP && oldP && oldP > 0) {
        cagrBy['5y'] = +(Math.pow(newP / oldP, 1 / Math.min(span, 5)) - 1).toFixed(4)
      }
    }

    result[key] = {
      unitCount: unitsSet.size || items.length,
      sales: sales12,
      cagrBy,
    }
  }
  return result
}

// ─── aggregate: by NSW Property ID (repeat-sale CAGR) ──────────────────────

function aggregateByProperty(sales) {
  const groups = new Map()
  for (const s of sales) {
    const key = `${s.district}:${s.propertyId}`
    let arr = groups.get(key)
    if (!arr) {
      arr = []
      groups.set(key, arr)
    }
    arr.push(s)
  }

  const result = {}
  for (const items of groups.values()) {
    if (items.length < 2) continue
    items.sort((a, b) => a.date.localeCompare(b.date))
    const span =
      (new Date(items[items.length - 1].date).getTime() -
        new Date(items[0].date).getTime()) /
      (365.25 * 86_400_000)
    const first = items[0].price
    const last = items[items.length - 1].price
    const ownCagr = span > 0 ? +(Math.pow(last / first, 1 / span) - 1).toFixed(4) : null

    const slug = slugifyAddress(items[0])
    result[slug] = {
      propertyId: items[0].propertyId,
      sales: items.map((s) => ({ price: s.price, date: s.date })),
      ownCagr,
    }
  }
  return result
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `NSW PSI aggregator: ${START_YEAR}–${CURRENT_YEAR} (${YEARS_BACK} years back)`,
  )
  const allSales = []
  for (let y = START_YEAR; y <= CURRENT_YEAR; y++) {
    await processYear(y, allSales)
  }
  console.log(
    `Total residential sales (STRATA + RESIDENCE): ${allSales.length.toLocaleString()}`,
  )

  if (allSales.length === 0) {
    console.error('Aborting: no sales data parsed')
    process.exitCode = 1
    return
  }

  console.log('\nAggregating by suburb…')
  const suburbStats = aggregateBySuburb(allSales)
  const suburbJson = JSON.stringify(suburbStats)
  writeFileSync(OUT_SUBURB, suburbJson)
  console.log(
    `  → ${OUT_SUBURB} (${(suburbJson.length / 1024 / 1024).toFixed(1)} MB, ${
      Object.keys(suburbStats).length
    } suburbs)`,
  )

  console.log('Aggregating by building…')
  const buildingHistory = aggregateByBuilding(allSales)
  const buildingJson = JSON.stringify(buildingHistory)
  writeFileSync(OUT_BUILDING, buildingJson)
  console.log(
    `  → ${OUT_BUILDING} (${(buildingJson.length / 1024 / 1024).toFixed(1)} MB, ${
      Object.keys(buildingHistory).length
    } buildings)`,
  )

  console.log('Aggregating by property…')
  const propertyHistory = aggregateByProperty(allSales)
  const propertyJson = JSON.stringify(propertyHistory)
  writeFileSync(OUT_PROPERTY, propertyJson)
  console.log(
    `  → ${OUT_PROPERTY} (${(propertyJson.length / 1024 / 1024).toFixed(1)} MB, ${
      Object.keys(propertyHistory).length
    } properties)`,
  )

  console.log('\n✓ Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
