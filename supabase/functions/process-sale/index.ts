import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  subtotal: number
}

interface SaleRequest {
  customer_name: string | null
  payment_method: string
  total_amount: number
  subtotal: number
  discount_type: 'percentage' | 'amount' | 'none'
  discount_value: number
  discount_amount: number
  customer_address?: string | null
  items: SaleItem[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const saleData: SaleRequest = await req.json()

    console.log('Processing sale for user:', user.id)
    console.log('Sale items:', saleData.items.length)
    console.log('📦 Items to process:', JSON.stringify(saleData.items, null, 2))

    // Validate stock availability for all items before processing
    for (const item of saleData.items) {
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('quantity, stock_boite, stock_barre, category')
        .eq('id', item.product_id)
        .single()

      if (productError) {
        throw new Error(`Product ${item.product_name} not found`)
      }

      // Check the appropriate stock field based on product category
      let availableStock: number
      if (product.category === 'ceramique' && product.stock_boite !== null) {
        availableStock = product.stock_boite
      } else if (product.category === 'fer' && product.stock_barre !== null) {
        availableStock = product.stock_barre
      } else if (product.stock_barre !== null && product.stock_barre > 0) {
        // Fallback: if stock_barre is present and positive, treat as iron bars
        availableStock = product.stock_barre
      } else {
        availableStock = product.quantity
      }

      if (availableStock < item.quantity) {
        throw new Error(`Stock insuffisant pour ${item.product_name}. Disponible: ${availableStock}`)
      }
    }

    console.log('✅ Stock validation passed for all items')

    // Create sale record
    const { data: sale, error: saleError } = await supabaseClient
      .from('sales')
      .insert([{
        customer_name: saleData.customer_name,
        seller_id: user.id,
        total_amount: saleData.total_amount,
        subtotal: saleData.subtotal,
        discount_type: saleData.discount_type,
        discount_value: saleData.discount_value,
        discount_amount: saleData.discount_amount,
        notes: saleData.customer_address,
        payment_method: saleData.payment_method,
      }])
      .select()
      .single()

    if (saleError) {
      console.error('Sale creation error:', saleError)
      throw new Error('Failed to create sale')
    }

    console.log('✅ Sale created:', sale.id)

    // Process each item: create sale_item, update stock, and create stock_movement
    for (const item of saleData.items) {
      // Get current product with all fields including purchase_price
      const { data: currentProduct, error: fetchError } = await supabaseClient
        .from('products')
        .select('quantity, stock_boite, stock_barre, category, purchase_price')
        .eq('id', item.product_id)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch product ${item.product_name}`)
      }

      // Calculate profit
      const purchasePriceAtSale = currentProduct.purchase_price || 0
      const profitAmount = (item.unit_price - purchasePriceAtSale) * item.quantity

      // Insert sale item with profit data
      const { error: itemError } = await supabaseClient
        .from('sale_items')
        .insert([{
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          purchase_price_at_sale: purchasePriceAtSale,
          profit_amount: profitAmount
        }])

      if (itemError) {
        console.error('Sale item error:', itemError)
        throw new Error(`Failed to create sale item for ${item.product_name}`)
      }

      // Determine which stock field to update based on category
      let previousQuantity: number
      let newQuantity: number
      let updateData: any = {}
      let stockField: string // Track which field we're updating

      if (currentProduct.category === 'ceramique' && currentProduct.stock_boite !== null) {
        // For ceramics, update stock_boite
        previousQuantity = currentProduct.stock_boite
        newQuantity = previousQuantity - item.quantity
        updateData = { stock_boite: newQuantity }
        stockField = 'stock_boite'
      } else if (currentProduct.category === 'fer' && currentProduct.stock_barre !== null) {
        // For iron bars, update stock_barre
        previousQuantity = currentProduct.stock_barre
        newQuantity = previousQuantity - item.quantity
        updateData = { stock_barre: newQuantity }
        stockField = 'stock_barre'
      } else if (currentProduct.stock_barre !== null && currentProduct.stock_barre > 0) {
        // Fallback: treat as iron bars if stock_barre is present and positive
        previousQuantity = currentProduct.stock_barre
        newQuantity = previousQuantity - item.quantity
        updateData = { stock_barre: newQuantity }
        stockField = 'stock_barre'
      } else {
        // For all other products, update quantity
        previousQuantity = currentProduct.quantity
        newQuantity = previousQuantity - item.quantity
        updateData = { quantity: newQuantity }
        stockField = 'quantity'
      }

      console.log(`Updating ${stockField} for ${item.product_name}: ${previousQuantity} -> ${newQuantity}`)

      // Update product stock
      const { error: updateError } = await supabaseClient
        .from('products')
        .update(updateData)
        .eq('id', item.product_id)

      if (updateError) {
        console.error('Product update error:', updateError)
        throw new Error(`Failed to update stock for ${item.product_name}`)
      }

      // Record stock movement
      const { error: movementError } = await supabaseClient
        .from('stock_movements')
        .insert([{
          product_id: item.product_id,
          movement_type: 'out',
          quantity: -item.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          reason: `Vente #${sale.id}`,
          sale_id: sale.id,
          created_by: user.id,
        }])

      if (movementError) {
        console.error('Stock movement error:', movementError)
        throw new Error(`Failed to record stock movement for ${item.product_name}`)
      }

      console.log(`Stock updated for ${item.product_name}: ${previousQuantity} -> ${newQuantity}`)
      console.log(`Profit recorded: ${profitAmount.toFixed(2)} HTG (purchase: ${purchasePriceAtSale}, sale: ${item.unit_price})`)
    }

    // Create activity log
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single()

      await supabaseClient
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action_type: 'sale_created',
          entity_type: 'sale',
          entity_id: sale.id,
          description: `Vente de ${saleData.total_amount.toFixed(2)} HTG créée par ${profile?.full_name || 'Vendeur'} pour ${saleData.customer_name || 'Client anonyme'}`,
          metadata: {
            total_amount: saleData.total_amount,
            items_count: saleData.items.length,
            payment_method: saleData.payment_method
          }
        })
    } catch (logError) {
      console.error('Failed to create activity log:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sale: sale,
        message: 'Vente enregistrée avec succès'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('🔴 Error processing sale:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
