/**
 * 显示同楼盘 + 同单元的历史成交（数据来自 NSW PSI）
 * 数据未到位时整个 component 静默不渲染。
 */
import { formatCurrency } from '@/lib/utils'
import type { PropertyRecord } from '@/lib/properties'

// Lazy require — 文件不存在时模块解析会 throw
let buildingHistory: Record<string, BuildingHistory> = {}
let propertyHistory: Record<string, PropertyHistory> = {}
try {
  buildingHistory = require('@/data/building-history.json')
} catch {
  /* not generated yet */
}
try {
  propertyHistory = require('@/data/property-history.json')
} catch {
  /* not generated yet */
}

interface BuildingHistory {
  unitCount?: number
  sales?: Array<{ unit?: string; price: number; date: string }>
  medianBy?: Record<string, number>
  cagrBy?: Record<string, number>
}

interface PropertyHistory {
  propertyId?: number
  sales?: Array<{ price: number; date: string }>
  ownCagr?: number
}

function buildingKeyFromAddress(address: string): string {
  // "14/35 Enid Avenue, Granville NSW 2142" → "35 Enid Avenue, Granville"
  const stripUnit = address.replace(/^[\w]+\/\s*/, '')
  const parts = stripUnit.split(',').map((s) => s.trim())
  if (parts.length < 2) return stripUnit
  const street = parts[0]
  const suburb = parts[1].split(/\s+/)[0]
  return `${street}, ${suburb}`
}

export default function SaleHistory({ property }: { property: PropertyRecord }) {
  const buildingKey = buildingKeyFromAddress(property.address)
  const propKey = property.id

  const bld = buildingHistory[buildingKey]
  const own = propertyHistory[propKey]

  if (!bld && !own) return null // 数据没生成就不显示

  return (
    <div className="my-6 rounded-lg border bg-white p-4">
      <h2 className="text-base font-semibold">📊 历史成交（NSW PSI）</h2>

      {own?.sales && own.sales.length >= 2 && (
        <section className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground">
            🏠 这个单元自己历次成交
            {own.ownCagr != null && (
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                CAGR {(own.ownCagr * 100).toFixed(1)}%
              </span>
            )}
          </p>
          <table className="mt-1.5 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left">日期</th>
                <th className="text-right">价格</th>
                <th className="text-right">变化</th>
              </tr>
            </thead>
            <tbody>
              {own.sales.map((s, i) => {
                const prev = i > 0 ? own.sales![i - 1] : null
                const delta = prev ? (s.price / prev.price - 1) * 100 : null
                return (
                  <tr key={i} className="border-t">
                    <td className="py-1">{s.date}</td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.price)}
                    </td>
                    <td className="text-right tabular-nums">
                      {delta !== null && (
                        <span
                          className={
                            delta >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }
                        >
                          {delta > 0 ? '+' : ''}
                          {delta.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {bld?.sales && bld.sales.length > 0 && (
        <section className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">
            🏢 同楼盘 {bld.unitCount ?? bld.sales.length} 个单元的近期成交
            {bld.cagrBy?.['5y'] != null && (
              <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                5Y CAGR {(bld.cagrBy['5y'] * 100).toFixed(1)}%
              </span>
            )}
          </p>
          <table className="mt-1.5 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left">单元</th>
                <th className="text-left">日期</th>
                <th className="text-right">价格</th>
              </tr>
            </thead>
            <tbody>
              {bld.sales.slice(0, 12).map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">{s.unit ?? '-'}</td>
                  <td className="py-1">{s.date}</td>
                  <td className="text-right tabular-nums">
                    {formatCurrency(s.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        来源：NSW Valuer General Property Sales Information (公开数据，CC 4.0)
      </p>
    </div>
  )
}
