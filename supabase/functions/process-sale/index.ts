import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface SaleRequest {
  customer_name: string | null
  payment_method: string
  total_amount: number
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

    // Validate stock availability for all items before processing
    for (const item of saleData.items) {
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .single()

      if (productError) {
        throw new Error(`Product ${item.product_name} not found`)
      }

      if (product.quantity < item.quantity) {
        throw new Error(`Stock insuffisant pour ${item.product_name}. Disponible: ${product.quantity}`)
      }
    }

    // Create sale record
    const { data: sale, error: saleError } = await supabaseClient
      .from('sales')
      .insert([{
        customer_name: saleData.customer_name,
        seller_id: user.id,
        total_amount: saleData.total_amount,
        payment_method: saleData.payment_method,
      }])
      .select()
      .single()

    if (saleError) {
      console.error('Sale creation error:', saleError)
      throw new Error('Failed to create sale')
    }

    console.log('Sale created:', sale.id)

    // Process each item: create sale_item, update stock, and create stock_movement
    for (const item of saleData.items) {
      // Insert sale item
      const { error: itemError } = await supabaseClient
        .from('sale_items')
        .insert([{
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        }])

      if (itemError) {
        console.error('Sale item error:', itemError)
        throw new Error(`Failed to create sale item for ${item.product_name}`)
      }

      // Get current product quantity
      const { data: currentProduct, error: fetchError } = await supabaseClient
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch product ${item.product_name}`)
      }

      const previousQuantity = currentProduct.quantity
      const newQuantity = previousQuantity - item.quantity

      // Update product quantity
      const { error: updateError } = await supabaseClient
        .from('products')
        .update({ quantity: newQuantity })
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
    console.error('Error processing sale:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
