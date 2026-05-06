import Link from 'next/link'
import type { PropertyRecord } from '@/lib/properties'
import { formatCurrency } from '@/lib/utils'

export default function PropertyCard({
  property,
}: {
  property: PropertyRecord
}) {
  return (
    <Link
      href={`/property/${property.id}`}
      className="group block overflow-hidden rounded-lg border bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {property.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={property.imageUrl}
            alt={property.address}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-300">
            No image
          </div>
        )}
        {property.confidence && (
          <span
            className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              property.confidence === 'high'
                ? 'bg-emerald-100 text-emerald-700'
                : property.confidence === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {property.confidence}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-lg font-bold tracking-tight">
          {formatCurrency(property.price)}
        </p>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {property.address}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          {property.bedrooms !== undefined && (
            <span>🛏 {property.bedrooms}</span>
          )}
          {property.bathrooms !== undefined && (
            <span>🛁 {property.bathrooms}</span>
          )}
          {property.carSpaces !== undefined && (
            <span>🚗 {property.carSpaces}</span>
          )}
          {property.weeklyRent !== undefined && (
            <span className="ml-auto font-medium text-slate-700">
              ${property.weeklyRent}/周
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
