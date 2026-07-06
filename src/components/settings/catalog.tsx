'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Lock,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currency';
import { SettingsPanelHead } from './settings-panel-head';

interface CatalogSummary {
  id: string;
  name?: string;
  product_count?: number;
}

interface CommerceSettings {
  is_cart_enabled?: boolean;
  is_catalog_visible?: boolean;
}

interface Overview {
  configured: boolean;
  reason?: string;
  message?: string;
  catalog?: CatalogSummary | null;
  commerceSettings?: CommerceSettings | null;
}

interface Product {
  id: string;
  retailer_id?: string;
  name?: string;
  description?: string;
  price?: string;
  currency?: string;
  availability?: string;
  image_url?: string;
  url?: string;
}

const COMMERCE_MANAGER_URL = 'https://business.facebook.com/commerce/';

export function Catalog() {
  const canEdit = useCan('edit-settings');
  const { defaultCurrency } = useAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);

  const [cartEnabled, setCartEnabled] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/catalog');
      const data = (await res.json()) as Overview & { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Failed to load catalogue');
        setOverview({ configured: false });
        return;
      }
      setOverview(data);
      setCartEnabled(!!data.commerceSettings?.is_cart_enabled);
      setCatalogVisible(!!data.commerceSettings?.is_catalog_visible);
    } catch {
      toast.error('Failed to load catalogue');
      setOverview({ configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(
    async (catalogId: string, after?: string) => {
      if (after) setLoadingMore(true);
      else setProductsLoading(true);
      try {
        const params = new URLSearchParams({ catalog_id: catalogId });
        if (after) params.set('after', after);
        const res = await fetch(`/api/whatsapp/catalog/products?${params}`);
        const data = await res.json();
        if (!data.ok) {
          setProductsError(data.message ?? 'Could not load products.');
          if (!after) setProducts([]);
          return;
        }
        setProductsError(null);
        setProducts((prev) =>
          after ? [...prev, ...(data.products ?? [])] : data.products ?? [],
        );
        setNextAfter(data.nextAfter ?? null);
      } catch {
        setProductsError('Could not load products.');
      } finally {
        setProductsLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const catalogId = overview?.catalog?.id;
  useEffect(() => {
    if (!catalogId) return;
    loadProducts(catalogId);
  }, [catalogId, loadProducts]);

  async function toggleSetting(which: 'cart' | 'visible', value: boolean) {
    if (which === 'cart') setCartEnabled(value);
    else setCatalogVisible(value);
    setSavingSettings(true);
    try {
      const body =
        which === 'cart'
          ? { is_cart_enabled: value }
          : { is_catalog_visible: value };
      const res = await fetch('/api/whatsapp/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update commerce settings');
        // Revert the optimistic flip.
        if (which === 'cart') setCartEnabled(!value);
        else setCatalogVisible(!value);
        return;
      }
      toast.success('Commerce settings updated');
    } catch {
      toast.error('Failed to update commerce settings');
      if (which === 'cart') setCartEnabled(!value);
      else setCatalogVisible(!value);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('Remove this product from the catalogue?')) return;
    setDeletingId(productId);
    try {
      const res = await fetch(
        `/api/whatsapp/catalog/products?product_id=${encodeURIComponent(productId)}`,
        { method: 'DELETE' },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove product');
        return;
      }
      toast.success('Product removed');
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch {
      toast.error('Failed to remove product');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Catalogue"
          description="Manage the products customers can browse in WhatsApp, and how your catalogue shows in chats."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  // WhatsApp not connected at all.
  if (!overview?.configured) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Catalogue"
          description="Manage the products customers can browse in WhatsApp, and how your catalogue shows in chats."
        />
        <Alert>
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
          <AlertTitle>Connect WhatsApp first</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {overview?.message ??
                'WhatsApp is not connected yet. Connect it to manage your catalogue.'}
            </p>
            <Link
              href="/settings/whatsapp"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Go to WhatsApp settings
              <ExternalLink className="size-3.5" />
            </Link>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const hasCatalog = !!overview.catalog;

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="Catalogue"
        description="Manage the products customers can browse in WhatsApp, and how your catalogue shows in chats. Backed by Meta Commerce."
        action={
          hasCatalog && canEdit ? (
            <Button onClick={() => setAddOpen(true)} className="h-10">
              <Plus className="size-4" />
              Add product
            </Button>
          ) : null
        }
      />

      {!canEdit && (
        <Alert>
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <AlertDescription>
            You have read-only access. Only admins and owners can edit the
            catalogue and commerce settings.
          </AlertDescription>
        </Alert>
      )}

      {/* No catalogue connected — explain the reason + point to Commerce Manager. */}
      {!hasCatalog && (
        <Alert>
          <ShoppingBag className="size-5 shrink-0 text-muted-foreground" />
          <AlertTitle>
            {overview.reason === 'no_waba'
              ? 'WhatsApp Business Account id missing'
              : overview.reason === 'permission'
                ? 'Catalogue access needs an extra permission'
                : 'No catalogue connected'}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {overview.message ??
                'No catalogue is connected to your WhatsApp Business Account yet.'}
            </p>
            {overview.reason === 'no_waba' ? (
              <Link
                href="/settings/whatsapp"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Go to WhatsApp settings
                <ExternalLink className="size-3.5" />
              </Link>
            ) : (
              <a
                href={COMMERCE_MANAGER_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open Meta Commerce Manager
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      {hasCatalog && (
        <>
          {/* Catalogue summary */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 px-6 py-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {overview.catalog?.name || 'Connected catalogue'}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  ID {overview.catalog?.id}
                </p>
              </div>
              {typeof overview.catalog?.product_count === 'number' && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {overview.catalog.product_count} product
                  {overview.catalog.product_count === 1 ? '' : 's'}
                </span>
              )}
            </CardContent>
          </Card>

          {/* Commerce settings */}
          {overview.commerceSettings ? (
            <Card>
              <CardContent className="divide-y divide-border px-6 py-2">
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Show catalogue in chats
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Lets customers open your catalogue from the chat.
                    </p>
                  </div>
                  <Switch
                    checked={catalogVisible}
                    onCheckedChange={(v) => toggleSetting('visible', v)}
                    disabled={!canEdit || savingSettings}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Enable cart
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Customers can add items to a cart and send an order.
                    </p>
                  </div>
                  <Switch
                    checked={cartEnabled}
                    onCheckedChange={(v) => toggleSetting('cart', v)}
                    disabled={!canEdit || savingSettings}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Products */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Products</h3>

            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : productsError ? (
              <Alert>
                <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                <AlertTitle>Products can&apos;t be loaded</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{productsError}</p>
                  <p className="text-xs">
                    Managing products through the API requires the{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                      catalog_management
                    </code>{' '}
                    permission on your Meta app. You can always manage this
                    catalogue directly in{' '}
                    <a
                      href={COMMERCE_MANAGER_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Commerce Manager
                    </a>
                    .
                  </p>
                </AlertDescription>
              </Alert>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 py-12 text-center">
                <Package className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  No products yet
                </p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    className="mt-1"
                  >
                    <Plus className="size-3.5" />
                    Add your first product
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card"
                    >
                      <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted/50">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name || 'Product'}
                            className="size-full object-cover"
                          />
                        ) : (
                          <Package className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                        <p className="truncate text-sm font-medium text-foreground">
                          {product.name || 'Untitled product'}
                        </p>
                        <div className="flex items-center gap-2">
                          {product.price && (
                            <span className="text-sm text-foreground">
                              {product.price}
                            </span>
                          )}
                          {product.availability && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                product.availability === 'in stock'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {product.availability}
                            </span>
                          )}
                        </div>
                        {product.retailer_id && (
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            SKU {product.retailer_id}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          aria-label="Remove product"
                          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {nextAfter && catalogId && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => loadProducts(catalogId, nextAfter)}
                      disabled={loadingMore}
                    >
                      {loadingMore && <Loader2 className="size-4 animate-spin" />}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {catalogId && (
        <AddProductDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          catalogId={catalogId}
          defaultCurrency={defaultCurrency || DEFAULT_CURRENCY}
          onAdded={() => loadProducts(catalogId)}
        />
      )}
    </section>
  );
}

function AddProductDialog({
  open,
  onOpenChange,
  catalogId,
  defaultCurrency,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  defaultCurrency: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [retailerId, setRetailerId] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [availability, setAvailability] = useState<'in stock' | 'out of stock'>(
    'in stock',
  );
  const [imageUrl, setImageUrl] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const didInit = useRef(false);
  useEffect(() => {
    if (!open) {
      didInit.current = false;
      return;
    }
    if (didInit.current) return;
    didInit.current = true;
    // Seed the currency from the account default each time the dialog opens.
    setCurrency(defaultCurrency);
  }, [open, defaultCurrency]);

  const valid =
    name.trim() !== '' &&
    retailerId.trim() !== '' &&
    imageUrl.trim() !== '' &&
    Number(price) > 0;

  async function handleSubmit() {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog_id: catalogId,
          retailer_id: retailerId.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          price: Number(price),
          currency,
          availability,
          image_url: imageUrl.trim(),
          url: url.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add product');
        return;
      }
      toast.success('Product added');
      onAdded();
      onOpenChange(false);
      // Reset for the next open.
      setName('');
      setRetailerId('');
      setPrice('');
      setImageUrl('');
      setUrl('');
      setDescription('');
      setAvailability('in stock');
    } catch {
      toast.error('Failed to add product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-border bg-popover text-popover-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Add product
          </DialogTitle>
          <DialogDescription>
            Adds a product to your connected WhatsApp catalogue via the Meta
            API. The image URL must be publicly reachable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prod-name">Name</Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blue cotton t-shirt"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-sku">SKU / retailer id</Label>
              <Input
                id="prod-sku"
                value={retailerId}
                onChange={(e) => setRetailerId(e.target.value)}
                placeholder="e.g. TSHIRT-BLUE-M"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-avail">Availability</Label>
              <Select
                value={availability}
                onValueChange={(v) =>
                  setAvailability(v === 'out of stock' ? 'out of stock' : 'in stock')
                }
                disabled={saving}
              >
                <SelectTrigger id="prod-avail" className="h-11 w-full border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in stock">In stock</SelectItem>
                  <SelectItem value="out of stock">Out of stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-price">Price</Label>
              <Input
                id="prod-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="9.99"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v ?? defaultCurrency)}
                disabled={saving}
              >
                <SelectTrigger id="prod-currency" className="h-11 w-full border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-image">Image URL</Label>
            <Input
              id="prod-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/product.jpg"
              disabled={saving}
              inputMode="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-url">Product link (optional)</Label>
            <Input
              id="prod-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourstore.com/product"
              disabled={saving}
              inputMode="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-desc">Description (optional)</Label>
            <Textarea
              id="prod-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description customers will see"
              className="min-h-20 resize-none"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !valid}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Add product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
