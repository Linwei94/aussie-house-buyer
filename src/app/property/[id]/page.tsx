import Link from 'next/link'
import { notFound } from 'next/navigation'
import Calculator from '@/components/Calculator'
import {
  getAllProperties,
  getProperty,
  propertyToInputs,
} from '@/lib/properties'
import { formatCurrency } from '@/lib/utils'

export async function generateStaticParams() {
  const all = getAllProperties()
  // Static export requires at least one entry; provide a placeholder when empty
  if (all.length === 0) return [{ id: '__placeholder__' }]
  return all.map((p) => ({ id: p.id }))
}

export default function PropertyPage({
  params,
}: {
  params: { id: string }
}) {
  const property = getProperty(params.id)
  if (!property) notFound()

  const initialInputs = propertyToInputs(property)

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        ← 返回所有房产
      </Link>

      <div className="mb-6 grid gap-4 md:grid-cols-[360px_1fr]">
        <div className="overflow-hidden rounded-lg bg-slate-100">
          {property.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={property.imageUrl}
              alt={property.address}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-slate-300">
              No image
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-tight md:text-2xl">
            {property.address}
          </h1>
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {formatCurrency(property.price)}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
            {property.bedrooms !== undefined && (
              <span>🛏 {property.bedrooms} bed</span>
            )}
            {property.bathrooms !== undefined && (
              <span>🛁 {property.bathrooms} bath</span>
            )}
            {property.carSpaces !== undefined && (
              <span>🚗 {property.carSpaces} car</span>
            )}
            {property.weeklyRent !== undefined && (
              <span>💰 ${property.weeklyRent}/周（估）</span>
            )}
            {property.strataPerQuarter !== undefined && (
              <span>🏢 Strata ${property.strataPerQuarter}/季</span>
            )}
          </div>

          {(property.suburbApartmentGrowth1Y !== undefined ||
            property.suburbApartmentGrowth5Y !== undefined) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              {property.suburbApartmentGrowth1Y !== undefined && (
                <span>
                  {property.suburb} 公寓 1Y:{' '}
                  <strong className="text-slate-800">
                    {property.suburbApartmentGrowth1Y > 0 ? '+' : ''}
                    {property.suburbApartmentGrowth1Y.toFixed(1)}%
                  </strong>
                </span>
              )}
              {property.suburbApartmentGrowth5Y !== undefined && (
                <span>
                  5Y 累计:{' '}
                  <strong className="text-slate-800">
                    {property.suburbApartmentGrowth5Y > 0 ? '+' : ''}
                    {property.suburbApartmentGrowth5Y.toFixed(1)}%
                  </strong>
                </span>
              )}
            </div>
          )}

          {property.notes && (
            <p className="mt-3 text-sm text-slate-600">{property.notes}</p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs text-muted-foreground">
            {property.listingUrl && (
              <a
                href={property.listingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                ↗ 原始 listing
              </a>
            )}
            <span>研究于 {property.researchedAt}</span>
            {property.confidence && (
              <span
                className={`rounded-full px-2 py-0.5 ${
                  property.confidence === 'high'
                    ? 'bg-emerald-100 text-emerald-700'
                    : property.confidence === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                数据置信度: {property.confidence}
              </span>
            )}
          </div>

          {property.sources && property.sources.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-blue-600 hover:underline">
                数据来源 ({property.sources.length})
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {property.sources.map((s, i) => {
                  let host = s
                  try {
                    host = new URL(s).hostname
                  } catch {
                    /* keep raw */
                  }
                  return (
                    <li key={i}>
                      <a
                        href={s}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {host}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </div>
      </div>

      <Calculator initialInputs={initialInputs} />
    </main>
  )
}
