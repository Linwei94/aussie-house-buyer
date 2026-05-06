#!/usr/bin/env node
/**
 * NSW Property Sales Information (PSI) → suburb-stats aggregator.
 *
 * 数据来源：NSW Valuer General free bulk PSI files (CC 4.0)
 *   - 主页：https://www.valuergeneral.nsw.gov.au/psi/yearly_lists.php
 *   - 每年一个 zip，里面是按 LGA 分的 .DAT 文件
 *   - 行级数据自 1990 起公开
 *
 * 输出：src/data/suburb-stats.json
 *   {
 *     "Granville": {
 *       "STRATA": {
 *         "median": { "1y": 580000, "3y": 605000, "5y": 595000, "10y": 510000 },
 *         "cagr":   { "1y": -0.034, "3y": 0.012, "5y": 0.041, "10y": 0.038 },
 *         "count":  { "1y": 187, "3y": 612, "5y": 1024, "10y": 2200 },
 *         "lastSold": [
 *           { "address": "14/35 Enid Ave", "price": 750000, "date": "2026-04-22" },
 *           ...
 *         ]
 *       },
 *       "RESIDENCE": { ... }
 *     }
 *   }
 *
 * 使用：
 *   1. 运行 `node scripts/build-suburb-stats.mjs` 自动下载最近 10 年 PSI
 *   2. 解析 .DAT 文件（NSW 自定义格式：'B' 行是 building/property，'C' 行是 sale）
 *   3. 按 (suburb, propertyType) 聚合 + 算 CAGR
 *   4. 写入 src/data/suburb-stats.json
 *
 * 计划在 .github/workflows/refresh-suburb-stats.yml 里跑 cron 每月一次。
 *
 * NSW PSI .DAT 行格式参考：
 *   https://www.nsw.gov.au/sites/default/files/2023-08/current_property_sales_data_file_format.pdf
 *
 * 关键字段（B 行）：
 *   - District code, Property ID, Address, Suburb, Postcode
 *   - Property name (building name)
 *   - Area, Area type
 *   - Zone code (R3 等)
 *   - Property description (RESIDENCE / STRATA / VACANT LAND ...)
 *
 * 关键字段（C 行）：
 *   - Property ID, Sale counter, Download datetime
 *   - Contract date (YYYYMMDD)
 *   - Settlement date
 *   - Purchase price
 *   - Zoning, Nature of property (R/S/3/V)
 *   - Primary purpose
 *   - 注意：sale price < $1000 视为非 arm's length，过滤
 *
 * 注意：
 *   - 有时候 sale 是公司间转让（family transfer 等），nature_of_property 标 'F' 应过滤
 *   - 有时候 value 是 part-share，应 by primary purpose 过滤
 *   - .DAT 文件用 ';' 分隔，每行第一个字符标识行类型
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from 'node:https'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE_DIR = join(ROOT, '.psi-cache')
const OUT = join(ROOT, 'src/data/suburb-stats.json')

const CURRENT_YEAR = new Date().getFullYear()
const YEARS_TO_DOWNLOAD = 10 // 拿最近 10 年算 CAGR
const MIN_SALE_PRICE = 50000 // 过滤显然不真实的成交

// --- Step 1: download PSI yearly zips (idempotent, cached) ---
async function downloadYear(year) {
  const url = `https://www.valuergeneral.nsw.gov.au/__psi/yearly/${year}.zip`
  const file = join(CACHE_DIR, `${year}.zip`)
  if (existsSync(file)) return file
  // TODO: implement HTTPS download with retry
  // 注意：NSW 偶尔会改 URL pattern，必要时去主页找最新链接
  console.log(`Downloading ${url} → ${file}`)
  // Placeholder: actual download requires fetch / streamed write
  throw new Error('download not implemented in scaffold; run in CI with network')
}

// --- Step 2: parse .DAT files (semicolon-separated, multi-row per property) ---
function parseDatLine(line) {
  const parts = line.split(';')
  const tag = parts[0]
  if (tag === 'B') {
    return {
      type: 'B',
      propertyId: parts[2],
      addressUnit: parts[5],
      addressNum: parts[6],
      addressStreet: parts[7],
      suburb: parts[8],
      postcode: parts[9],
      area: parseFloat(parts[10]) || null,
      zoneCode: parts[12],
    }
  }
  if (tag === 'C') {
    return {
      type: 'C',
      propertyId: parts[2],
      contractDate: parts[5], // YYYYMMDD
      settlementDate: parts[6],
      purchasePrice: parseFloat(parts[7]) || 0,
      zoning: parts[8],
      natureOfProperty: parts[9], // R = residential
      primaryPurpose: parts[10], // RESIDENCE / STRATA / etc.
    }
  }
  return null
}

// --- Step 3: aggregate ---
function aggregate(sales) {
  // sales: [{ suburb, propertyType, price, contractDate }, ...]
  const bySuburb = new Map()
  const now = new Date()
  const winYears = [1, 3, 5, 10]

  for (const s of sales) {
    if (!s.suburb || !s.propertyType || s.price < MIN_SALE_PRICE) continue
    const yearsAgo =
      (now - new Date(s.contractDate)) / (365.25 * 24 * 3600 * 1000)
    if (yearsAgo > 10) continue
    const key = `${s.suburb}|${s.propertyType}`
    if (!bySuburb.has(key)) bySuburb.set(key, [])
    bySuburb.get(key).push({ ...s, yearsAgo })
  }

  const result = {}
  for (const [key, items] of bySuburb) {
    const [suburb, type] = key.split('|')
    items.sort((a, b) => a.contractDate.localeCompare(b.contractDate))

    const stats = {
      median: {},
      cagr: {},
      count: {},
      lastSold: items
        .slice(-10)
        .reverse()
        .map((s) => ({
          address: s.address,
          price: s.price,
          date: s.contractDate,
        })),
    }

    for (const w of winYears) {
      const window = items.filter((s) => s.yearsAgo <= w)
      const olderRef = items.filter(
        (s) => s.yearsAgo >= w && s.yearsAgo <= w + 1,
      )
      if (window.length === 0) continue
      const prices = window.map((s) => s.price).sort((a, b) => a - b)
      const median = prices[Math.floor(prices.length / 2)]
      stats.median[`${w}y`] = median
      stats.count[`${w}y`] = window.length

      if (olderRef.length > 0) {
        const olderPrices = olderRef.map((s) => s.price).sort((a, b) => a - b)
        const olderMedian = olderPrices[Math.floor(olderPrices.length / 2)]
        if (olderMedian > 0) {
          const totalGrowth = median / olderMedian
          stats.cagr[`${w}y`] = Math.pow(totalGrowth, 1 / w) - 1
        }
      }
    }

    if (!result[suburb]) result[suburb] = {}
    result[suburb][type] = stats
  }
  return result
}

// --- main ---
async function main() {
  mkdirSync(CACHE_DIR, { recursive: true })
  const startYear = CURRENT_YEAR - YEARS_TO_DOWNLOAD
  console.log(`Building suburb stats from ${startYear}–${CURRENT_YEAR}`)

  // For now: print plan + scaffold; full implementation requires network env
  console.log(`
Steps:
  1. Download ${YEARS_TO_DOWNLOAD} yearly PSI zips from valuergeneral.nsw.gov.au
  2. Unzip each → many LGA .DAT files
  3. Parse 'B' (property) + 'C' (sale) records, join on propertyId
  4. Aggregate by (suburb, propertyType) with 1Y/3Y/5Y/10Y windows
  5. Write src/data/suburb-stats.json (~3-5 MB JSON, gzipped ~600KB)

Run this script in an env with internet access. Suggested: GH Action cron monthly.
`)

  // Placeholder write for tooling validation
  if (!existsSync(OUT)) {
    writeFileSync(OUT, '{}\n')
    console.log(`Wrote empty placeholder ${OUT}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
