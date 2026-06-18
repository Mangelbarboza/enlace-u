import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Flag,
  ImagePlus,
  Package,
  RefreshCw,
  Search,
  Send,
  Store,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { COSTA_RICA_PROVINCES, UNIVERSITIES } from '../lib/constants'

type MarketplaceCategory = 'product' | 'service'
type MarketplaceSaleType = 'single' | 'made_to_order'
type MarketplaceStatus = 'active' | 'paused' | 'sold' | 'deleted'

type MarketplaceImage = {
  id: string
  item_id: string
  image_url: string
  storage_path: string
  position: number
}

type MarketplaceItem = {
  id: string
  seller_id: string
  seller_name: string
  seller_university: string | null
  seller_province: string | null
  title: string
  description: string
  price: number
  category: MarketplaceCategory
  sale_type: MarketplaceSaleType
  status: MarketplaceStatus
  created_at: string
  updated_at: string
  images: MarketplaceImage[]
}

type PurchaseIntent = {
  item_id: string
  conversation_id: string | null
  created_at: string
}

const MAX_IMAGES = 3
const MAX_IMAGE_SIZE = 1024 * 1024
const BUY_COOLDOWN_HOURS = 12

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getSaleTypeLabel(value: MarketplaceSaleType) {
  if (value === 'single') {
    return 'Único'
  }

  return 'Por encargo'
}

function getCategoryLabel(value: MarketplaceCategory) {
  if (value === 'product') {
    return 'Producto'
  }

  return 'Servicio'
}

function getStatusLabel(value: MarketplaceStatus) {
  if (value === 'active') {
    return 'Activa'
  }

  if (value === 'paused') {
    return 'Pausada'
  }

  if (value === 'sold') {
    return 'Vendida'
  }

  return 'Eliminada'
}

function isValidImage(file: File) {
  return (
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
    file.size <= MAX_IMAGE_SIZE
  )
}

export default function Marketplace() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.user_metadata?.display_name || 'Estudiante'
  const university = user?.user_metadata?.university || null
  const province =
    user?.user_metadata?.province || user?.user_metadata?.campus || null

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [myItems, setMyItems] = useState<MarketplaceItem[]>([])
  const [purchaseIntents, setPurchaseIntents] = useState<PurchaseIntent[]>([])

  const [searchText, setSearchText] = useState('')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [universityFilter, setUniversityFilter] = useState('')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState<MarketplaceCategory>('product')
  const [saleType, setSaleType] = useState<MarketplaceSaleType>('single')
  const [selectedImages, setSelectedImages] = useState<File[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null)
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const activeMyItemsCount = myItems.filter((item) => item.status === 'active').length

  const recentPurchaseItemIds = useMemo(() => {
    const limit = Date.now() - BUY_COOLDOWN_HOURS * 60 * 60 * 1000

    return new Set(
      purchaseIntents
        .filter((intent) => new Date(intent.created_at).getTime() >= limit)
        .map((intent) => intent.item_id),
    )
  }, [purchaseIntents])

  const filteredItems = useMemo(() => {
    const cleanSearch = searchText.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch = cleanSearch
        ? item.title.toLowerCase().includes(cleanSearch)
        : true

      const matchesProvince = provinceFilter
        ? item.seller_province === provinceFilter
        : true

      const matchesUniversity = universityFilter
        ? item.seller_university === universityFilter
        : true

      return matchesSearch && matchesProvince && matchesUniversity
    })
  }, [items, searchText, provinceFilter, universityFilter])

  function resetForm() {
    setTitle('')
    setDescription('')
    setPrice('')
    setCategory('product')
    setSaleType('single')
    setSelectedImages([])
    setIsFormOpen(false)
  }

  async function hydrateImages(baseItems: Omit<MarketplaceItem, 'images'>[]) {
    const itemIds = baseItems.map((item) => item.id)

    if (itemIds.length === 0) {
      return []
    }

    const { data: imagesData } = await supabase
      .from('marketplace_item_images')
      .select('id, item_id, image_url, storage_path, position')
      .in('item_id', itemIds)
      .order('position', { ascending: true })

    const images = (imagesData ?? []) as MarketplaceImage[]

    const imagesByItem = new Map<string, MarketplaceImage[]>()

    images.forEach((image) => {
      const current = imagesByItem.get(image.item_id) ?? []
      current.push(image)
      imagesByItem.set(image.item_id, current)
    })

    return baseItems.map((item) => ({
      ...item,
      images: imagesByItem.get(item.id) ?? [],
    }))
  }

  async function loadMarketplace(showAnimation = false) {
    setErrorMessage('')

    if (showAnimation) {
      setRefreshing(true)

      if ('vibrate' in navigator) {
        navigator.vibrate(20)
      }
    } else {
      setLoading(true)
    }

    const activeItemsQuery = supabase
      .from('marketplace_items')
      .select(
        'id, seller_id, seller_name, seller_university, seller_province, title, description, price, category, sale_type, status, created_at, updated_at',
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(80)

    const myItemsQuery = user
      ? supabase
          .from('marketplace_items')
          .select(
            'id, seller_id, seller_name, seller_university, seller_province, title, description, price, category, sale_type, status, created_at, updated_at',
          )
          .eq('seller_id', user.id)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false })
      : null

    const [activeItemsResult, myItemsResult] = await Promise.all([
      activeItemsQuery,
      myItemsQuery ?? Promise.resolve({ data: [], error: null }),
    ])

    if (activeItemsResult.error || myItemsResult.error) {
      setErrorMessage('No se pudo cargar el marketplace.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const activeBaseItems =
      (activeItemsResult.data ?? []) as Omit<MarketplaceItem, 'images'>[]
    const myBaseItems =
      (myItemsResult.data ?? []) as Omit<MarketplaceItem, 'images'>[]

    const uniqueItemsMap = new Map<string, Omit<MarketplaceItem, 'images'>>()

    activeBaseItems.forEach((item) => uniqueItemsMap.set(item.id, item))
    myBaseItems.forEach((item) => uniqueItemsMap.set(item.id, item))

    const hydratedAll = await hydrateImages(Array.from(uniqueItemsMap.values()))

    const hydratedById = new Map(hydratedAll.map((item) => [item.id, item]))

    setItems(
      activeBaseItems
        .map((item) => hydratedById.get(item.id))
        .filter(Boolean) as MarketplaceItem[],
    )

    setMyItems(
      myBaseItems
        .map((item) => hydratedById.get(item.id))
        .filter(Boolean) as MarketplaceItem[],
    )

    if (user) {
      const cooldownDate = new Date(
        Date.now() - BUY_COOLDOWN_HOURS * 60 * 60 * 1000,
      ).toISOString()

      const { data: intentsData } = await supabase
        .from('marketplace_purchase_intents')
        .select('item_id, conversation_id, created_at')
        .eq('buyer_id', user.id)
        .gte('created_at', cooldownDate)

      setPurchaseIntents((intentsData ?? []) as PurchaseIntent[])
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadMarketplace()
  }, [user?.id])

  function handleSelectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length > MAX_IMAGES) {
      setErrorMessage('Solo podés subir máximo 3 fotos.')
      return
    }

    const invalidImage = files.find((file) => !isValidImage(file))

    if (invalidImage) {
      setErrorMessage('Las imágenes deben ser JPG, PNG o WEBP y pesar máximo 1 MB.')
      return
    }

    setErrorMessage('')
    setSelectedImages(files)
  }

  async function uploadItemImages(itemId: string) {
    if (!user || selectedImages.length === 0) {
      return
    }

    const imagesPayload: {
      item_id: string
      image_url: string
      storage_path: string
      position: number
    }[] = []

    for (const [index, file] of selectedImages.entries()) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const safeName = `${Date.now()}-${index}-${crypto.randomUUID()}.${extension}`
      const storagePath = `${user.id}/${itemId}/${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('marketplace-images')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error('No se pudo subir una imagen.')
      }

      const { data: publicUrlData } = supabase.storage
        .from('marketplace-images')
        .getPublicUrl(storagePath)

      imagesPayload.push({
        item_id: itemId,
        image_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        position: index + 1,
      })
    }

    const { error: imageInsertError } = await supabase
      .from('marketplace_item_images')
      .insert(imagesPayload)

    if (imageInsertError) {
      throw new Error('No se pudieron guardar las imágenes.')
    }
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) {
      setErrorMessage('Necesitás iniciar sesión para publicar en el market.')
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    const cleanPrice = Number(price)

    if (!cleanTitle) {
      setErrorMessage('Escribí el nombre del producto o servicio.')
      return
    }

    if (cleanTitle.length > 80) {
      setErrorMessage('El nombre no puede pasar de 80 caracteres.')
      return
    }

    if (!cleanDescription) {
      setErrorMessage('Escribí una descripción.')
      return
    }

    if (cleanDescription.length > 700) {
      setErrorMessage('La descripción no puede pasar de 700 caracteres.')
      return
    }

    if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
      setErrorMessage('Escribí un precio válido en colones.')
      return
    }

    if (activeMyItemsCount >= 5) {
      setErrorMessage('Ya tenés 5 ventas activas. Pausá o marcá una como vendida.')
      return
    }

    setPublishing(true)

    const { data: itemData, error: itemError } = await supabase
      .from('marketplace_items')
      .insert({
        seller_id: user.id,
        seller_name: displayName,
        seller_university: university,
        seller_province: province,
        title: cleanTitle,
        description: cleanDescription,
        price: Math.round(cleanPrice),
        category,
        sale_type: saleType,
        status: 'active',
      })
      .select('id')
      .single()

    if (itemError || !itemData) {
      setPublishing(false)
      setErrorMessage('No se pudo crear la venta.')
      return
    }

    try {
      await uploadItemImages(itemData.id)
    } catch {
      setPublishing(false)
      setErrorMessage('Se creó la venta, pero hubo un problema con las imágenes.')
      await loadMarketplace(true)
      return
    }

    setPublishing(false)
    setSuccessMessage('Venta publicada correctamente.')
    resetForm()
    await loadMarketplace(true)
  }

  async function handleBuy(item: MarketplaceItem) {
    if (!user) {
      setErrorMessage('Necesitás iniciar sesión para comprar.')
      return
    }

    if (item.seller_id === user.id) {
      setErrorMessage('No podés comprar tu propia publicación.')
      return
    }

    if (recentPurchaseItemIds.has(item.id)) {
      setErrorMessage('Ya enviaste interés por esta publicación recientemente.')
      return
    }

    setBuyingItemId(item.id)
    setErrorMessage('')
    setSuccessMessage('')

    const { data, error } = await supabase.rpc('marketplace_start_purchase_chat', {
      target_item_id: item.id,
    })

    setBuyingItemId(null)

    if (error || !data) {
      setErrorMessage('No se pudo abrir el chat de compra.')
      return
    }

    await loadMarketplace(true)
    navigate(`/chats?c=${data}`)
  }

  async function handleReportItem(item: MarketplaceItem) {
    if (!user) {
      return
    }

    const { error } = await supabase.from('marketplace_reports').insert({
      item_id: item.id,
      reporter_id: user.id,
      reason: 'Reporte desde marketplace',
    })

    if (error) {
      setErrorMessage('No se pudo reportar o ya habías reportado esta publicación.')
      return
    }

    setSuccessMessage('Reporte enviado correctamente.')
  }

  async function handleUpdateItemStatus(
    item: MarketplaceItem,
    nextStatus: MarketplaceStatus,
  ) {
    if (!user) {
      return
    }

    if (
      nextStatus === 'active' &&
      item.status !== 'active' &&
      activeMyItemsCount >= 5
    ) {
      setErrorMessage('No podés activar más de 5 ventas al mismo tiempo.')
      return
    }

    setUpdatingItemId(item.id)
    setErrorMessage('')
    setSuccessMessage('')

    const { error } = await supabase
      .from('marketplace_items')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('seller_id', user.id)

    setUpdatingItemId(null)

    if (error) {
      setErrorMessage('No se pudo actualizar la venta.')
      return
    }

    setSuccessMessage('Venta actualizada.')
    await loadMarketplace(true)
  }

  function renderItemCard(item: MarketplaceItem, isMine = false) {
    const mainImage = item.images[0]
    const alreadySentInterest = recentPurchaseItemIds.has(item.id)
    const isOwnItem = item.seller_id === user?.id

    return (
      <article
        key={item.id}
        className="overflow-hidden rounded-3xl border bg-white shadow-sm"
      >
        <div className="aspect-square bg-slate-100">
          {mainImage ? (
            <img
              src={mainImage.image_url}
              alt={item.title}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
              <Package size={38} />
              <p className="text-xs font-bold">Sin foto</p>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900">
                {formatPrice(item.price)}
              </p>
              <h2 className="mt-1 line-clamp-2 text-sm font-bold text-slate-800">
                {item.title}
              </h2>
            </div>

            {!isMine && (
              <button
                type="button"
                onClick={() => handleReportItem(item)}
                className="rounded-xl bg-red-50 p-2 text-red-500"
              >
                <Flag size={16} />
              </button>
            )}
          </div>

          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
            {item.description}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {getCategoryLabel(item.category)}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {getSaleTypeLabel(item.sale_type)}
            </span>

            {isMine && (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                {getStatusLabel(item.status)}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {item.seller_university || 'Institución'}
            {item.seller_province ? ` • ${item.seller_province}` : ''}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Publicado por {item.seller_name} • {formatDate(item.created_at)}
          </p>

          {!isMine && (
            <button
              type="button"
              onClick={() => handleBuy(item)}
              disabled={buyingItemId === item.id || isOwnItem || alreadySentInterest}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {alreadySentInterest
                ? 'Interés enviado'
                : buyingItemId === item.id
                  ? 'Abriendo chat...'
                  : 'Comprar'}
            </button>
          )}

          {isMine && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {item.status !== 'active' && (
                <button
                  type="button"
                  onClick={() => handleUpdateItemStatus(item, 'active')}
                  disabled={updatingItemId === item.id}
                  className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  Activar
                </button>
              )}

              {item.status === 'active' && (
                <button
                  type="button"
                  onClick={() => handleUpdateItemStatus(item, 'paused')}
                  disabled={updatingItemId === item.id}
                  className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
                >
                  Pausar
                </button>
              )}

              {item.status !== 'sold' && (
                <button
                  type="button"
                  onClick={() => handleUpdateItemStatus(item, 'sold')}
                  disabled={updatingItemId === item.id}
                  className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
                >
                  Vendido
                </button>
              )}

              <button
                type="button"
                onClick={() => handleUpdateItemStatus(item, 'deleted')}
                disabled={updatingItemId === item.id}
                className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-60"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </article>
    )
  }

  return (
    <main>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Market</h1>
          <p className="mt-1 text-sm text-slate-500">
            Productos, servicios, tutorías y emprendimientos estudiantiles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadMarketplace(true)}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
        >
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">
            {refreshing ? 'Actualizando' : 'Recargar'}
          </span>
        </button>
      </header>

      <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm">
        {!isFormOpen ? (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-4 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <span>Crear nueva venta</span>
            <Store size={18} />
          </button>
        ) : (
          <form onSubmit={handleCreateItem} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Nombre
              </label>
              <input
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Nombre del producto o servicio"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {title.length}/80
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Descripción
              </label>
              <textarea
                value={description}
                maxLength={700}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Describí qué vendés, cómo se entrega o cómo funciona"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {description.length}/700
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Precio en colones
                </label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Ej: 2500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Tipo
                </label>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as MarketplaceCategory)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="product">Producto</option>
                  <option value="service">Servicio</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Modalidad
                </label>
                <select
                  value={saleType}
                  onChange={(event) =>
                    setSaleType(event.target.value as MarketplaceSaleType)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="single">Único</option>
                  <option value="made_to_order">Por encargo</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-700">
                <ImagePlus size={18} />
                Subir fotos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleSelectImages}
                  className="hidden"
                />
              </label>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Máximo 3 fotos. Cada foto debe pesar máximo 1 MB.
              </p>

              {selectedImages.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedImages.map((file) => (
                    <div
                      key={file.name}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                    >
                      {file.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={publishing}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {publishing ? 'Publicando...' : 'Publicar venta'}
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Ventas activas: {activeMyItemsCount}/5
            </p>
          </form>
        )}
      </section>

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <section className="mt-5 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Buscar producto o servicio"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="text-slate-400"
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            value={provinceFilter}
            onChange={(event) => setProvinceFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Todas las provincias</option>
            {COSTA_RICA_PROVINCES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={universityFilter}
            onChange={(event) => setUniversityFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Todas las instituciones</option>
            {UNIVERSITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-black uppercase text-slate-400">
          Publicaciones
        </h2>

        {loading && (
          <div className="mt-3 rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            Cargando marketplace...
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="mt-3 rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            No hay productos o servicios para mostrar.
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => renderItemCard(item))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-black uppercase text-slate-400">
          Mis ventas
        </h2>

        {myItems.length === 0 && (
          <div className="mt-3 rounded-3xl border bg-white p-5 text-sm text-slate-500 shadow-sm">
            Todavía no tenés ventas publicadas.
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myItems.map((item) => renderItemCard(item, true))}
        </div>
      </section>
    </main>
  )
}