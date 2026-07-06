import { NextResponse } from 'next/server'

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import {
  getCatalogProducts,
  createCatalogProduct,
  deleteCatalogProduct,
} from '@/lib/whatsapp/meta-api'
import { CURRENCIES } from '@/lib/currency'

const VALID_CURRENCIES = new Set(CURRENCIES.map((c) => c.code))
// ISO-4217 currencies with no minor unit among the ones we offer — their
// price is passed as-is instead of being multiplied to "cents".
const ZERO_DECIMAL = new Set(['JPY'])

/** Thrown by the field guards below; mapped to a 400 at the call site. */
class ValidationError extends Error {}

function toMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency) ? Math.round(amount) : Math.round(amount * 100)
}

/**
 * GET /api/whatsapp/catalog/products?catalog_id=&after=
 *
 * Any member can read. Returns 200 with { ok: false, message } when Meta
 * rejects the read (typically a missing `catalog_management` permission)
 * so the page can render an explained state instead of a hard error.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { searchParams } = new URL(request.url)
    const catalogId = searchParams.get('catalog_id')
    const after = searchParams.get('after') ?? undefined
    if (!catalogId) {
      return NextResponse.json({ error: 'catalog_id is required' }, { status: 400 })
    }

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, message: 'WhatsApp is not connected.' },
        { status: 200 },
      )
    }

    try {
      const { products, nextAfter } = await getCatalogProducts({
        catalogId,
        accessToken: access.access.accessToken,
        after,
      })
      return NextResponse.json({ ok: true, products, nextAfter })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        ok: false,
        reason: 'permission',
        message: `Could not load products: ${message}`,
      })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/whatsapp/catalog/products
 *
 * Admin+ only. Creates a product in the catalogue.
 * Body: { catalog_id, retailer_id, name, description?, price (major units),
 *         currency, availability, image_url, url? }
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const {
      catalog_id,
      retailer_id,
      name,
      description,
      price,
      currency,
      availability,
      image_url,
      url,
    } = body as Record<string, unknown>

    const requireStr = (v: unknown, label: string) => {
      if (typeof v !== 'string' || v.trim() === '') {
        throw new ValidationError(`${label} is required`)
      }
      return v.trim()
    }

    try {
      const catalogId = requireStr(catalog_id, 'catalog_id')
      const retailerId = requireStr(retailer_id, 'SKU / retailer id')
      const cleanName = requireStr(name, 'Name')
      const imageUrl = requireStr(image_url, 'Image URL')

      if (!/^https?:\/\//i.test(imageUrl)) {
        return NextResponse.json(
          { error: 'Image URL must start with http:// or https://' },
          { status: 400 },
        )
      }
      if (typeof url === 'string' && url.trim() && !/^https?:\/\//i.test(url.trim())) {
        return NextResponse.json(
          { error: 'Product URL must start with http:// or https://' },
          { status: 400 },
        )
      }

      const currencyCode = requireStr(currency, 'Currency')
      if (!VALID_CURRENCIES.has(currencyCode)) {
        return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
      }

      const priceNum = typeof price === 'number' ? price : Number(price)
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return NextResponse.json(
          { error: 'Price must be a positive number' },
          { status: 400 },
        )
      }

      const avail = availability === 'out of stock' ? 'out of stock' : 'in stock'

      const access = await loadWhatsAppAccess(supabase, accountId)
      if (!access.ok) {
        return NextResponse.json(
          { error: 'WhatsApp is not connected, or its token could not be read.' },
          { status: 400 },
        )
      }

      const { id } = await createCatalogProduct({
        catalogId,
        accessToken: access.access.accessToken,
        product: {
          retailerId,
          name: cleanName,
          description:
            typeof description === 'string' ? description.trim() || undefined : undefined,
          priceMinorUnits: toMinorUnits(priceNum, currencyCode),
          currency: currencyCode,
          availability: avail,
          imageUrl,
          url: typeof url === 'string' ? url.trim() || undefined : undefined,
        },
      })
      return NextResponse.json({ success: true, id })
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/whatsapp/catalog/products?product_id=
 *
 * Admin+ only. Removes a product from the catalogue.
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    if (!productId) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        { error: 'WhatsApp is not connected, or its token could not be read.' },
        { status: 400 },
      )
    }

    try {
      await deleteCatalogProduct({
        productId,
        accessToken: access.access.accessToken,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
