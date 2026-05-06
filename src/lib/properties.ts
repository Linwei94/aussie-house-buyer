import propertiesJson from '@/data/properties.json'
import type { Inputs } from './calculations'

export interface PropertyRecord {
  /** url-safe slug, e.g. "marrickville-king-12-45" */
  id: string
  address: string
  suburb: string
  state: 'NSW' | 'VIC' | 'QLD'
  /** Hot-linked image URL from domain.com.au or realestate.com.au CDN */
  imageUrl: string
  listingUrl?: string
  price: number
  bedrooms: number
  bathrooms?: number
  carSpaces?: number
  /** Property type: apartment, townhouse, house */
  propertyType?: 'apartment' | 'townhouse' | 'house'
  /** weekly rent estimate */
  weeklyRent?: number
  weeklyRentRange?: [number, number]
  strataPerQuarter?: number
  councilPerYear?: number
  waterPerYear?: number
  /** suburb-level apartment growth (1Y / 5Y cumulative) */
  suburbApartmentGrowth1Y?: number
  suburbApartmentGrowth5Y?: number
  /** ISO date when researched */
  researchedAt: string
  sources?: string[]
  notes?: string
  confidence?: 'high' | 'medium' | 'low'
}

export function getAllProperties(): PropertyRecord[] {
  return (propertiesJson as PropertyRecord[]).slice().sort((a, b) =>
    (b.researchedAt ?? '').localeCompare(a.researchedAt ?? ''),
  )
}

export function getProperty(id: string): PropertyRecord | undefined {
  return getAllProperties().find((p) => p.id === id)
}

/** Convert a researched PropertyRecord into calculator Inputs (partial override). */
export function propertyToInputs(p: PropertyRecord): Partial<Inputs> {
  const cagr5y =
    p.suburbApartmentGrowth5Y !== undefined
      ? Math.pow(1 + p.suburbApartmentGrowth5Y / 100, 1 / 5) * 100 - 100
      : undefined

  return {
    price: p.price,
    state: p.state,
    propertyData: {
      listingUrl: p.listingUrl,
      address: p.address,
      rentPerWeek: p.weeklyRent,
      strataPerQuarter: p.strataPerQuarter,
      councilPerYear: p.councilPerYear,
      waterPerYear: p.waterPerYear,
      suburbAppreciation: cagr5y,
    },
  }
}
