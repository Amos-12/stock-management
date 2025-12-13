import jsPDF from 'jspdf';

export interface CartItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  cartQuantity: number;
  actualPrice?: number;
  price: number;
  displayUnit?: string;
  diametre?: string;
  longueur_barre?: number;
  bars_per_ton?: number;
  sourceUnit?: 'barre' | 'tonne';
  sourceValue?: number;
  currency?: 'USD' | 'HTG';
}

export interface CompanySettings {
  company_name: string;
  company_description?: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  tva_rate: number;
  logo_url?: string;
  logo_position_x?: number;
  logo_position_y?: number;
  logo_width?: number;
  logo_height?: number;
  payment_terms?: string;
  usd_htg_rate?: number;
  default_display_currency?: 'USD' | 'HTG';
}

export interface SaleData {
  id: string;
  customer_name: string | null;
  customer_address?: string | null;
  payment_method: string;
  total_amount: number;
  subtotal: number;
  discount_type: 'percentage' | 'amount' | 'none';
  discount_value: number;
  discount_amount: number;
  created_at: string;
}

// Utility function to convert decimal tonnage to fractional display
export const getTonnageLabel = (tonnage: number): string => {
  const integerPart = Math.floor(tonnage);
  const decimalPart = tonnage - integerPart;
  
  let fractionStr = '';
  if (Math.abs(decimalPart - 0.25) < 0.01) {
    fractionStr = '1/4';
  } else if (Math.abs(decimalPart - 0.5) < 0.01) {
    fractionStr = '1/2';
  } else if (Math.abs(decimalPart - 0.75) < 0.01) {
    fractionStr = '3/4';
  } else if (decimalPart > 0.01) {
    fractionStr = decimalPart.toFixed(2);
  }
  
  if (integerPart > 0) {
    return fractionStr ? `${integerPart} ${fractionStr} tonne${tonnage > 1 ? 's' : ''}` : `${integerPart} tonne${integerPart > 1 ? 's' : ''}`;
  } else {
    return fractionStr ? `${fractionStr} tonne` : `${tonnage.toFixed(2)} tonne${tonnage > 1 ? 's' : ''}`;
  }
};

// Convert bars to tonnage for display
const barresToTonnage = (barres: number, barsPerTon: number): number => {
  return barres / barsPerTon;
};

// Check if bars quantity corresponds to a clean tonnage fraction
const shouldDisplayAsTonnage = (barres: number, barsPerTon: number): boolean => {
  const tonnage = barres / barsPerTon;
  const fractions = [0, 0.25, 0.5, 0.75];
  const decimalPart = tonnage - Math.floor(tonnage);
  return fractions.some(f => Math.abs(decimalPart - f) < 0.01);
};

// Intelligent format for iron quantity - display EITHER tonne OR barre
const formatIronQuantity = (barres: number, barsPerTon: number, compact: boolean = false): string => {
  if (shouldDisplayAsTonnage(barres, barsPerTon)) {
    const tonnage = barres / barsPerTon;
    return getTonnageLabel(tonnage);
  } else {
    return compact ? `${barres} br` : `${barres} barres`;
  }
};

// Helper function to format numbers with regular ASCII space as thousand separator
const formatNumber = (num: number, decimals = 0): string => {
  const fixed = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();
  const [intPart, decPart] = fixed.split('.');
  const withSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${withSeparator}.${decPart}` : withSeparator;
};

const formatAmount = (amount: number, currency: 'USD' | 'HTG' | boolean = true, compact = false): string => {
  // Always use regular ASCII space as thousand separator (not non-breaking space)
  const formatted = formatNumber(amount, 2);
  if (currency === false) return formatted;
  if (currency === 'USD') return `$${formatted}`;
  return `${formatted} HTG`;
};

export const generateReceipt = (
  saleData: SaleData,
  companySettings: CompanySettings,
  items: CartItem[],
  sellerName: string,
  width: number = 80 // Default 80mm, can be 58mm or 80mm
) => {
  // Calculate approximate height needed based on content
  const baseHeight = 180; // Header and footer with extra margin for safety
  const itemHeight = 8; // Approximate height per item
  const estimatedHeight = Math.max(180, baseHeight + (items.length * itemHeight)); // Ensure footer always fits
  
  const pdf = new jsPDF({
    unit: 'mm',
    format: [width, estimatedHeight],
    orientation: 'portrait'
  });

  pdf.setFont('helvetica', 'normal');
  let yPos = 5;
  
  // Responsive margins and sizing based on width
  const margin = width === 58 ? 3 : 5;
  const contentWidth = width - (margin * 2);
  const logoSize = width === 58 ? 20 : 30;
  const titleFontSize = width === 58 ? 10 : 12;
  const regularFontSize = width === 58 ? 5.5 : 6.5; // Further reduced for compact spacing
  
  // Add logo if available (centered)
  if (companySettings.logo_url) {
    try {
      const logoW = companySettings.logo_width || logoSize;
      const logoH = companySettings.logo_height || logoSize;
      const logoX = companySettings.logo_position_x || (width - logoW) / 2; // Center on receipt width
      const logoY = companySettings.logo_position_y || yPos;
      pdf.addImage(companySettings.logo_url, 'PNG', logoX, logoY, logoW, logoH);
      yPos += logoH + 3;
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }
  
  // Company name - center with overflow protection
  pdf.setFontSize(titleFontSize);
  pdf.setFont('helvetica', 'bold');
  const companyName = companySettings.company_name;
  const nameWidth = pdf.getTextWidth(companyName);
  const maxTextWidth = contentWidth - 2; // Safety margin
  if (nameWidth > maxTextWidth) {
    // Truncate if too long
    const truncatedName = companyName.substring(0, Math.floor(companyName.length * (maxTextWidth / nameWidth))) + '...';
    pdf.text(truncatedName, margin + 1, yPos);
  } else {
    pdf.text(companyName, (width - nameWidth) / 2, yPos);
  }
  yPos += 4;
  
  // Company description - center with overflow protection
  if (companySettings.company_description) {
    pdf.setFontSize(regularFontSize);
    pdf.setFont('helvetica', 'normal');
    const desc = companySettings.company_description;
    const descWidth = pdf.getTextWidth(desc);
    if (descWidth > maxTextWidth) {
      const truncatedDesc = desc.substring(0, Math.floor(desc.length * (maxTextWidth / descWidth))) + '...';
      pdf.text(truncatedDesc, margin + 1, yPos);
    } else {
      pdf.text(desc, (width - descWidth) / 2, yPos);
    }
    yPos += 3;
  }
  
  // Address - center with overflow protection
  pdf.setFontSize(regularFontSize);
  const address = `${companySettings.address}, ${companySettings.city}`;
  const addressWidth = pdf.getTextWidth(address);
  if (addressWidth > maxTextWidth) {
    const truncatedAddress = address.substring(0, Math.floor(address.length * (maxTextWidth / addressWidth))) + '...';
    pdf.text(truncatedAddress, margin + 1, yPos);
  } else {
    pdf.text(address, (width - addressWidth) / 2, yPos);
  }
  yPos += 3;
  
  // Contact info - center with overflow protection
  const contact = `Tél: ${companySettings.phone}`;
  const contactWidth = pdf.getTextWidth(contact);
  if (contactWidth > maxTextWidth) {
    const truncatedContact = contact.substring(0, Math.floor(contact.length * (maxTextWidth / contactWidth))) + '...';
    pdf.text(truncatedContact, margin + 1, yPos);
  } else {
    pdf.text(contact, (width - contactWidth) / 2, yPos);
  }
  yPos += 3;
  
  // Email - center with overflow protection
  const email = companySettings.email;
  const emailWidth = pdf.getTextWidth(email);
  if (emailWidth > maxTextWidth) {
    const truncatedEmail = email.substring(0, Math.floor(email.length * (maxTextWidth / emailWidth))) + '...';
    pdf.text(truncatedEmail, margin + 1, yPos);
  } else {
    pdf.text(email, (width - emailWidth) / 2, yPos);
  }
  yPos += 6;
  
  // Separator
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 5;
  
  // Receipt title
  pdf.setFontSize(titleFontSize - 1);
  pdf.setFont('helvetica', 'bold');
  const receiptTitle = 'REÇU DE VENTE';
  const titleWidth = pdf.getTextWidth(receiptTitle);
  pdf.text(receiptTitle, (width - titleWidth) / 2, yPos);
  yPos += 6;
  
  // Transaction details
  pdf.setFontSize(regularFontSize);
  pdf.setFont('helvetica', 'normal');
  const date = new Date(saleData.created_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  pdf.text(`Date: ${date}`, margin, yPos);
  yPos += 4;
  
  // Generate receipt number: REC + YYYYMMDDHHMMSS
  const receiptDate = new Date(saleData.created_at);
  const receiptNumber = `REC${receiptDate.getFullYear()}${String(receiptDate.getMonth() + 1).padStart(2, '0')}${String(receiptDate.getDate()).padStart(2, '0')}${String(receiptDate.getHours()).padStart(2, '0')}${String(receiptDate.getMinutes()).padStart(2, '0')}${String(receiptDate.getSeconds()).padStart(2, '0')}`;
  pdf.text(`N° Reçu: ${receiptNumber}`, margin, yPos);
  yPos += 4;
  pdf.text(`Vendeur: ${sellerName}`, margin, yPos);
  yPos += 4;
  
  if (saleData.customer_name) {
    pdf.text(`Client: ${saleData.customer_name}`, margin, yPos);
    yPos += 4;
  }
  
  if (saleData.customer_address) {
    pdf.text(`Adresse: ${saleData.customer_address}`, margin, yPos);
    yPos += 4;
  }
  
  yPos += 2;
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 5;
  
  // Items header - optimized column positioning to prevent overlap
  const descMaxWidth = width === 58 ? 18 : 24;  // Max width for description
  const qtyCol = width === 58 ? 22 : 28;        // Quantity column start
  const priceCol = width === 58 ? 34 : 44;      // Unit price column start
  const amountCol = width - margin;             // Total column (right-aligned)
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(width === 58 ? 7 : 8);
  pdf.text('Article', margin, yPos);
  pdf.text('Qté', qtyCol, yPos);
  pdf.text('P.U.', priceCol, yPos);
  pdf.text('Total', amountCol, yPos, { align: 'right' });
  yPos += 4;
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 4;
  
  // Items
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(width === 58 ? 6 : 7);
  const maxNameLength = width === 58 ? 7 : 10;
  
  items.forEach(item => {
    // Build item description with details
    let itemDescription = item.name;
    if (item.category === 'fer' && item.diametre) {
      itemDescription = `Fer Ø${item.diametre}`;
    }
    
    const itemName = itemDescription.length > maxNameLength ? itemDescription.substring(0, maxNameLength - 1) + '.' : itemDescription;
    pdf.text(itemName, margin, yPos);
    
    // Quantity display - INTELLIGENT: show tonne OR barre based on quantity
    let qtyText = '';
    if (item.category === 'fer' && item.bars_per_ton) {
      const barsQty = Math.round(item.cartQuantity);
      qtyText = formatIronQuantity(barsQty, item.bars_per_ton, true);
    } else if (item.category === 'fer') {
      qtyText = `${Math.round(item.cartQuantity)} br`;
    } else {
      const unit = item.displayUnit || item.unit;
      qtyText = `${item.cartQuantity} ${unit}`;
    }
    
    pdf.text(qtyText, qtyCol, yPos);
    
    // Unit price with currency (compact) - format with regular space separator
    const unitPrice = item.actualPrice ? item.actualPrice / item.cartQuantity : item.price;
    const formattedPrice = formatNumber(unitPrice);
    pdf.text(formattedPrice, priceCol, yPos);
    
    // Item total with currency
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    const itemCurrency = item.currency || 'HTG';
    const formattedTotal = formatNumber(itemTotal) + (itemCurrency === 'USD' ? '$' : '');
    pdf.text(formattedTotal, amountCol, yPos, { align: 'right' });
    yPos += 5;
    
    if (yPos > 270) {
      pdf.addPage([width, 297]);
      yPos = 10;
    }
  });
  
  yPos += 2;
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 5;
  
  // Calculate totals by currency
  let totalUSD = 0;
  let totalHTG = 0;
  items.forEach(item => {
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    if (item.currency === 'USD') {
      totalUSD += itemTotal;
    } else {
      totalHTG += itemTotal;
    }
  });
  const hasMultipleCurrencies = totalUSD > 0 && totalHTG > 0;
  const rate = companySettings.usd_htg_rate || 132;
  const displayCurrency = companySettings.default_display_currency || 'HTG';
  
  // Calculate unified subtotal (before discount)
  const unifiedSubtotal = displayCurrency === 'HTG' 
    ? totalHTG + (totalUSD * rate)
    : totalUSD + (totalHTG / rate);
  
  // Totals by currency if multi-currency
  pdf.setFont('helvetica', 'bold');
  if (hasMultipleCurrencies) {
    if (totalHTG > 0) {
      pdf.text('Sous-total HTG:', margin, yPos);
      pdf.text(formatAmount(totalHTG, 'HTG', true), width - margin, yPos, { align: 'right' });
      yPos += 5;
    }
    if (totalUSD > 0) {
      pdf.text('Sous-total USD:', margin, yPos);
      pdf.text(formatAmount(totalUSD, 'USD', true), width - margin, yPos, { align: 'right' });
      yPos += 5;
    }
    // Exchange rate
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(regularFontSize - 1);
    pdf.text(`Taux: 1 USD = ${rate.toFixed(2)} HTG`, margin, yPos);
    yPos += 5;
    pdf.setFontSize(regularFontSize);
    pdf.setFont('helvetica', 'bold');
    
    // Unified subtotal HT
    pdf.text('Sous-total HT:', margin, yPos);
    pdf.text(formatAmount(unifiedSubtotal, displayCurrency, true), width - margin, yPos, { align: 'right' });
    yPos += 5;
  } else {
    pdf.text('Sous-total HT:', margin, yPos);
    pdf.text(formatAmount(saleData.subtotal, displayCurrency, true), width - margin, yPos, { align: 'right' });
    yPos += 5;
  }
  
  // Discount amount (use stored value directly)
  const discountAmount = saleData.discount_amount || 0;
  if (discountAmount > 0) {
    pdf.setFont('helvetica', 'normal');
    const discountLabel = saleData.discount_type === 'percentage' 
      ? `Remise (${saleData.discount_value}%):`
      : 'Remise:';
    pdf.text(discountLabel, margin, yPos);
    pdf.text(`-${formatAmount(discountAmount, displayCurrency, true)}`, width - margin, yPos, { align: 'right' });
    yPos += 5;
  }
  
  // Calculate after discount and TVA (same logic as invoice)
  const baseSubtotal = hasMultipleCurrencies ? unifiedSubtotal : saleData.subtotal;
  const afterDiscount = baseSubtotal - discountAmount;
  const tvaAmount = afterDiscount * (companySettings.tva_rate / 100);
  
  // TVA
  pdf.setFont('helvetica', 'normal');
  pdf.text(`TVA (${companySettings.tva_rate}%):`, margin, yPos);
  pdf.text(formatAmount(tvaAmount, displayCurrency, true), width - margin, yPos, { align: 'right' });
  yPos += 5;
  
  // Final total TTC
  const finalTotal = afterDiscount + tvaAmount;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(titleFontSize - 1);
  pdf.text('TOTAL TTC:', margin, yPos);
  pdf.text(formatAmount(finalTotal, displayCurrency, true), width - margin, yPos, { align: 'right' });
  yPos += 6;
  
  // Payment method
  pdf.setFontSize(regularFontSize);
  pdf.setFont('helvetica', 'normal');
  const methodLabels: Record<string, string> = {
    'espece': 'Espèces',
    'cheque': 'Chèque',
    'virement': 'Virement'
  };
  pdf.text(`Mode de paiement: ${methodLabels[saleData.payment_method] || saleData.payment_method}`, margin, yPos);
  yPos += 6;
  
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 5;
  
  // Thank you message
  pdf.setFontSize(regularFontSize + 1);
  pdf.setFont('helvetica', 'italic');
  const thanks = 'Merci de votre confiance !';
  const thanksWidth = pdf.getTextWidth(thanks);
  pdf.text(thanks, (width - thanksWidth) / 2, yPos);
  
  // Open in new window for printing
  const pdfBlob = pdf.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

export const generateInvoice = (
  saleData: SaleData,
  companySettings: CompanySettings,
  items: CartItem[],
  sellerName: string
) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let yPos = 20;
  
  // Logo
  if (companySettings.logo_url) {
    try {
      const logoX = companySettings.logo_position_x || 15;
      const logoY = companySettings.logo_position_y || 15;
      const logoW = companySettings.logo_width || 40;
      const logoH = companySettings.logo_height || 40;
      pdf.addImage(companySettings.logo_url, 'PNG', logoX, logoY, logoW, logoH);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }
  
  // Company info (top right)
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.company_name, 210 - 15, yPos, { align: 'right' });
  yPos += 5;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  if (companySettings.company_description) {
    pdf.text(companySettings.company_description, 210 - 15, yPos, { align: 'right' });
    yPos += 4;
  }
  pdf.text(companySettings.address, 210 - 15, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(companySettings.city, 210 - 15, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(`Tél: ${companySettings.phone}`, 210 - 15, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(companySettings.email, 210 - 15, yPos, { align: 'right' });
  
  // Reset yPos for title
  yPos = 70;
  
  // Invoice title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FACTURE', 105, yPos, { align: 'center' });
  yPos += 10;
  
  // Invoice details
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const invoiceDate = new Date(saleData.created_at).toLocaleDateString('fr-FR');
  pdf.text(`Date: ${invoiceDate}`, 15, yPos);
  
  // Generate invoice number: FAC + YYYYMMDDHHMMSS
  const invoiceDateTime = new Date(saleData.created_at);
  const invoiceNumber = `FAC${invoiceDateTime.getFullYear()}${String(invoiceDateTime.getMonth() + 1).padStart(2, '0')}${String(invoiceDateTime.getDate()).padStart(2, '0')}${String(invoiceDateTime.getHours()).padStart(2, '0')}${String(invoiceDateTime.getMinutes()).padStart(2, '0')}${String(invoiceDateTime.getSeconds()).padStart(2, '0')}`;
  pdf.text(`N° Facture: ${invoiceNumber}`, 15, yPos + 6);
  yPos += 18;
  
  // Customer info
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FACTURÉ À:', 15, yPos);
  yPos += 6;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  if (saleData.customer_name) {
    pdf.text(saleData.customer_name, 15, yPos);
    yPos += 5;
  }
  if (saleData.customer_address) {
    pdf.text(saleData.customer_address, 15, yPos);
    yPos += 5;
  }
  
  yPos += 10;
  
  // Table header - improved column positions
  pdf.setFillColor(240, 240, 240);
  pdf.rect(15, yPos, 180, 8, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Description', 17, yPos + 5);
  pdf.text('Qté', 95, yPos + 5, { align: 'right' });
  pdf.text('Unité', 115, yPos + 5, { align: 'right' });
  pdf.text('Prix unit.', 150, yPos + 5, { align: 'right' });
  pdf.text('Montant', 188, yPos + 5, { align: 'right' });
  yPos += 10;
  
  // Table items
  pdf.setFont('helvetica', 'normal');
  items.forEach(item => {
    if (yPos > 270) {
      pdf.addPage();
      yPos = 20;
    }
    
    // Build item description with details
    let itemDescription = item.name;
    if (item.category === 'fer' && item.diametre) {
      itemDescription = `${item.name} Ø${item.diametre}`;
      if (item.longueur_barre) {
        itemDescription += ` - L:${item.longueur_barre}m`;
      }
    }
    
    // Truncate description if too long
    const maxDescLength = 45;
    const displayDesc = itemDescription.length > maxDescLength 
      ? itemDescription.substring(0, maxDescLength - 2) + '..' 
      : itemDescription;
    pdf.text(displayDesc, 17, yPos);
    
    // Quantity display - INTELLIGENT: show EITHER tonne OR barre
    let qtyDisplay = '';
    let unitText = '';
    
    if (item.category === 'fer' && item.bars_per_ton) {
      const barsQty = Math.round(item.cartQuantity);
      if (shouldDisplayAsTonnage(barsQty, item.bars_per_ton)) {
        // Clean tonnage - display as tonne
        const tonnage = barsQty / item.bars_per_ton;
        qtyDisplay = getTonnageLabel(tonnage);
        unitText = '';
      } else {
        // Not a clean tonnage - display as barres
        qtyDisplay = barsQty.toString();
        unitText = 'barres';
      }
    } else if (item.category === 'fer') {
      qtyDisplay = Math.round(item.cartQuantity).toString();
      unitText = 'barres';
    } else {
      qtyDisplay = item.cartQuantity.toString();
      unitText = item.displayUnit || item.unit;
    }
    
    pdf.text(qtyDisplay, 95, yPos, { align: 'right' });
    pdf.text(unitText, 115, yPos, { align: 'right' });
    
    // Unit price and total with currency
    const itemCurrency = item.currency || 'HTG';
    const unitPrice = item.actualPrice ? item.actualPrice / item.cartQuantity : item.price;
    pdf.text(formatAmount(unitPrice, itemCurrency), 150, yPos, { align: 'right' });
    
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    pdf.text(formatAmount(itemTotal, itemCurrency), 188, yPos, { align: 'right' });
    yPos += 6;
  });
  
  yPos += 5;
  pdf.line(15, yPos, 195, yPos);
  yPos += 10;
  
  // Calculate totals by currency
  let subtotalHTG = 0;
  let subtotalUSD = 0;
  items.forEach(item => {
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    if (item.currency === 'USD') {
      subtotalUSD += itemTotal;
    } else {
      subtotalHTG += itemTotal;
    }
  });
  
  const hasMultipleCurrencies = subtotalUSD > 0 && subtotalHTG > 0;
  const rate = companySettings.usd_htg_rate || 132;
  const displayCurrency = companySettings.default_display_currency || 'HTG';
  
  // Calculate unified subtotal in the display currency
  const unifiedSubtotal = displayCurrency === 'HTG'
    ? subtotalHTG + (subtotalUSD * rate)
    : subtotalUSD + (subtotalHTG / rate);
  
  // Discount - use the stored discount_amount directly (already calculated correctly)
  let discountAmount = 0;
  if (saleData.discount_amount > 0) {
    // Convert to display currency if needed
    discountAmount = displayCurrency === 'HTG' 
      ? saleData.discount_amount 
      : saleData.discount_amount / rate;
  }
  
  const afterDiscount = unifiedSubtotal - discountAmount;
  const tvaAmount = afterDiscount * (companySettings.tva_rate / 100);
  const totalTTC = afterDiscount + tvaAmount;
  
  // ============= PROFESSIONAL TOTALS BOX =============
  const boxX = 110;
  const boxWidth = 85;
  const labelX = boxX + 3;
  const valueX = boxX + boxWidth - 3;
  const lineHeight = 7;
  
  // Calculate box height based on content
  let linesCount = 2; // Sous-total HT + TVA + Total TTC (mandatory)
  if (hasMultipleCurrencies) linesCount += 3; // USD + HTG + Taux
  if (discountAmount > 0) linesCount += 1;
  linesCount += 1; // Total TTC
  
  const boxHeight = (linesCount * lineHeight) + 12; // Extra padding for total
  const boxY = yPos;
  
  // Draw rounded box with light background
  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(200, 200, 200);
  pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'FD');
  
  let currentY = boxY + 6;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  // Show sub-totals by currency if multi-currency
  if (hasMultipleCurrencies) {
    pdf.text('Sous-total USD', labelX, currentY);
    pdf.text(formatAmount(subtotalUSD, 'USD'), valueX, currentY, { align: 'right' });
    currentY += lineHeight;
    
    pdf.text('Sous-total HTG', labelX, currentY);
    pdf.text(formatAmount(subtotalHTG, 'HTG'), valueX, currentY, { align: 'right' });
    currentY += lineHeight;
    
    // Exchange rate info
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Taux: 1 USD = ${rate.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG`, labelX, currentY);
    pdf.setTextColor(0, 0, 0);
    currentY += lineHeight;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
  }
  
  // Sous-total HT (unified)
  pdf.text('Sous-total HT', labelX, currentY);
  pdf.text(formatAmount(unifiedSubtotal, displayCurrency), valueX, currentY, { align: 'right' });
  currentY += lineHeight;
  
  // Discount
  if (discountAmount > 0) {
    const discountLabel = saleData.discount_type === 'percentage'
      ? `Remise (${saleData.discount_value}%)`
      : 'Remise';
    pdf.setTextColor(220, 53, 69); // Red for discount
    pdf.text(discountLabel, labelX, currentY);
    pdf.text(`-${formatAmount(discountAmount, displayCurrency)}`, valueX, currentY, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
    currentY += lineHeight;
  }
  
  // TVA
  pdf.text(`TVA (${companySettings.tva_rate}%)`, labelX, currentY);
  pdf.text(formatAmount(tvaAmount, displayCurrency), valueX, currentY, { align: 'right' });
  currentY += lineHeight + 2;
  
  // Separator line before total
  pdf.setDrawColor(150, 150, 150);
  pdf.line(labelX, currentY - 2, valueX, currentY - 2);
  
  // Total TTC - prominent style
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setFillColor(33, 37, 41); // Dark background
  pdf.setTextColor(255, 255, 255); // White text
  pdf.roundedRect(boxX, currentY - 1, boxWidth, 10, 1, 1, 'F');
  pdf.text('TOTAL TTC', labelX + 1, currentY + 5);
  pdf.text(formatAmount(totalTTC, displayCurrency), valueX - 1, currentY + 5, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
  
  yPos = boxY + boxHeight + 10;
  
  // Payment method
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const methodLabels: Record<string, string> = {
    'espece': 'Espèces',
    'cheque': 'Chèque',
    'virement': 'Virement bancaire'
  };
  pdf.text(`Mode de paiement: ${methodLabels[saleData.payment_method] || saleData.payment_method}`, 15, yPos);
  yPos += 6;
  
  // Payment terms
  if (companySettings.payment_terms) {
    pdf.setFont('helvetica', 'italic');
    pdf.text(companySettings.payment_terms, 15, yPos);
    yPos += 6;
  }
  
  // Footer
  yPos = 280;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'italic');
  const thanks = 'Merci de votre confiance !';
  pdf.text(thanks, 105, yPos, { align: 'center' });
  
  // Save PDF
  const fileName = `facture_${saleData.id.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};

// Interface for Advanced Report PDF
export interface AdvancedReportData {
  totalRevenue: number;
  totalSales: number;
  totalProfit: number;
  averageOrderValue: number;
  topProducts: { product_name: string; quantity_sold: number; total_revenue: number }[];
  salesByPeriod: { period: string; revenue: number; sales: number }[];
  paymentMethods: { method: string; count: number; percentage: number }[];
  categoryDistribution: { category: string; revenue: number; count: number; percentage: number }[];
}

export const generateAdvancedReportPDF = (
  reportData: AdvancedReportData,
  companySettings: CompanySettings,
  dateRange: { from: Date; to: Date }
) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Helper function to check page break
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      pdf.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header with logo
  if (companySettings.logo_url) {
    try {
      const logoX = companySettings.logo_position_x || 15;
      const logoY = companySettings.logo_position_y || 15;
      const logoW = companySettings.logo_width || 35;
      const logoH = companySettings.logo_height || 35;
      pdf.addImage(companySettings.logo_url, 'PNG', logoX, logoY, logoW, logoH);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Company info (top right)
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.company_name, pageWidth - margin, yPos, { align: 'right' });
  yPos += 5;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  if (companySettings.company_description) {
    pdf.text(companySettings.company_description, pageWidth - margin, yPos, { align: 'right' });
    yPos += 4;
  }
  pdf.text(companySettings.address, pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(companySettings.city, pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(`Tél: ${companySettings.phone}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(companySettings.email, pageWidth - margin, yPos, { align: 'right' });

  // Reset yPos for title
  yPos = 65;

  // Report title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RAPPORT DE VENTES', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Date range
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const fromDate = dateRange.from.toLocaleDateString('fr-FR');
  const toDate = dateRange.to.toLocaleDateString('fr-FR');
  pdf.text(`Période: ${fromDate} - ${toDate}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  pdf.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Summary section (4 boxes)
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RÉSUMÉ', margin, yPos);
  yPos += 8;

  const boxWidth = (contentWidth - 15) / 4;
  const boxHeight = 25;
  const boxY = yPos;

  const summaryItems = [
    { label: "Chiffre d'affaires", value: formatAmount(reportData.totalRevenue), color: [34, 197, 94] },
    { label: "Bénéfices", value: formatAmount(reportData.totalProfit), color: [59, 130, 246] },
    { label: "Nb. Ventes", value: reportData.totalSales.toString(), color: [168, 85, 247] },
    { label: "Panier moyen", value: formatAmount(reportData.averageOrderValue), color: [249, 115, 22] }
  ];

  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * (boxWidth + 5);
    
    // Box background
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
    
    // Text
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(item.label, boxX + boxWidth / 2, boxY + 8, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item.value, boxX + boxWidth / 2, boxY + 18, { align: 'center' });
  });

  pdf.setTextColor(0, 0, 0);
  yPos = boxY + boxHeight + 15;

  // Category Distribution Table
  checkPageBreak(50);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RÉPARTITION PAR CATÉGORIE', margin, yPos);
  yPos += 8;

  // Table header
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Catégorie', margin + 3, yPos + 5);
  pdf.text('Revenu', margin + 90, yPos + 5, { align: 'right' });
  pdf.text('Ventes', margin + 120, yPos + 5, { align: 'right' });
  pdf.text('%', margin + contentWidth - 3, yPos + 5, { align: 'right' });
  yPos += 10;

  pdf.setFont('helvetica', 'normal');
  reportData.categoryDistribution.slice(0, 8).forEach((cat, idx) => {
    checkPageBreak(8);
    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
    }
    pdf.text(cat.category, margin + 3, yPos);
    pdf.text(formatAmount(cat.revenue), margin + 90, yPos, { align: 'right' });
    pdf.text(cat.count.toString(), margin + 120, yPos, { align: 'right' });
    pdf.text(`${cat.percentage.toFixed(1)}%`, margin + contentWidth - 3, yPos, { align: 'right' });
    yPos += 7;
  });
  yPos += 10;

  // Top 10 Products Table
  checkPageBreak(60);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOP 10 PRODUITS', margin, yPos);
  yPos += 8;

  // Table header
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('#', margin + 3, yPos + 5);
  pdf.text('Produit', margin + 12, yPos + 5);
  pdf.text('Qté', margin + 120, yPos + 5, { align: 'right' });
  pdf.text('Revenu', margin + contentWidth - 3, yPos + 5, { align: 'right' });
  yPos += 10;

  pdf.setFont('helvetica', 'normal');
  reportData.topProducts.forEach((prod, idx) => {
    checkPageBreak(8);
    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
    }
    pdf.text((idx + 1).toString(), margin + 3, yPos);
    const productName = prod.product_name.length > 40 
      ? prod.product_name.substring(0, 37) + '...' 
      : prod.product_name;
    pdf.text(productName, margin + 12, yPos);
    pdf.text(prod.quantity_sold.toString(), margin + 120, yPos, { align: 'right' });
    pdf.text(formatAmount(prod.total_revenue), margin + contentWidth - 3, yPos, { align: 'right' });
    yPos += 7;
  });
  yPos += 10;

  // Payment Methods Table
  checkPageBreak(40);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('MÉTHODES DE PAIEMENT', margin, yPos);
  yPos += 8;

  const methodLabels: Record<string, string> = {
    'espece': 'Espèces',
    'cash': 'Espèces',
    'cheque': 'Chèque',
    'virement': 'Virement bancaire',
    'mobile': 'Mobile Money'
  };

  // Table header
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Méthode', margin + 3, yPos + 5);
  pdf.text('Transactions', margin + 100, yPos + 5, { align: 'right' });
  pdf.text('%', margin + contentWidth - 3, yPos + 5, { align: 'right' });
  yPos += 10;

  pdf.setFont('helvetica', 'normal');
  reportData.paymentMethods.forEach((pm, idx) => {
    checkPageBreak(8);
    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
    }
    pdf.text(methodLabels[pm.method] || pm.method, margin + 3, yPos);
    pdf.text(pm.count.toString(), margin + 100, yPos, { align: 'right' });
    pdf.text(`${pm.percentage.toFixed(1)}%`, margin + contentWidth - 3, yPos, { align: 'right' });
    yPos += 7;
  });
  yPos += 10;

  // Chronological History (last 15 days max)
  if (reportData.salesByPeriod.length > 0) {
    checkPageBreak(60);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('HISTORIQUE CHRONOLOGIQUE', margin, yPos);
    yPos += 8;

    // Table header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, contentWidth, 8, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Date', margin + 3, yPos + 5);
    pdf.text('Revenu', margin + 100, yPos + 5, { align: 'right' });
    pdf.text('Ventes', margin + contentWidth - 3, yPos + 5, { align: 'right' });
    yPos += 10;

    pdf.setFont('helvetica', 'normal');
    const historyData = reportData.salesByPeriod.slice(-15);
    historyData.forEach((sp, idx) => {
      checkPageBreak(8);
      if (idx % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
      }
      const dateStr = new Date(sp.period).toLocaleDateString('fr-FR');
      pdf.text(dateStr, margin + 3, yPos);
      pdf.text(formatAmount(sp.revenue), margin + 100, yPos, { align: 'right' });
      pdf.text(sp.sales.toString(), margin + contentWidth - 3, yPos, { align: 'right' });
      yPos += 7;
    });
  }

  // Footer
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Généré par ${companySettings.company_name} - ${new Date().toLocaleDateString('fr-FR')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save PDF
  const fileName = `rapport_ventes_${dateRange.from.toISOString().split('T')[0]}_${dateRange.to.toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};

// ============= INVENTORY REPORT =============

export interface InventoryReportItem {
  productName: string;
  barcode?: string;
  category: string;
  expectedStock: number;
  actualStock: number | null;
  verified: boolean;
  adjusted: boolean;
  stockUnit: string;
  pendingSync?: boolean;
}

export interface InventoryReportData {
  sessionStart: Date;
  sessionEnd: Date;
  operatorName: string;
  scannedItems: InventoryReportItem[];
  stats: {
    total: number;
    verified: number;
    adjusted: number;
    pending: number;
    pendingSync: number;
  };
}

export const generateInventoryReport = (
  data: InventoryReportData,
  companySettings: CompanySettings
) => {
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 20;

  const checkPageBreak = (needed: number) => {
    if (yPos + needed > pageHeight - 20) {
      pdf.addPage();
      yPos = 20;
    }
  };

  // Header - Company info
  if (companySettings.logo_url) {
    try {
      const logoW = companySettings.logo_width || 30;
      const logoH = companySettings.logo_height || 30;
      pdf.addImage(companySettings.logo_url, 'PNG', margin, yPos - 5, logoW, logoH);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.company_name, pageWidth - margin, yPos, { align: 'right' });
  yPos += 5;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${companySettings.address}, ${companySettings.city}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(`Tél: ${companySettings.phone}`, pageWidth - margin, yPos, { align: 'right' });

  yPos = 55;

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text("RAPPORT D'INVENTAIRE", pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Session info
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const formatDateTime = (date: Date) => date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  pdf.text(`Période: ${formatDateTime(data.sessionStart)} - ${formatDateTime(data.sessionEnd)}`, margin, yPos);
  yPos += 5;
  pdf.text(`Opérateur: ${data.operatorName}`, margin, yPos);
  yPos += 10;

  // Stats boxes
  const boxWidth = (contentWidth - 15) / 4;
  const boxHeight = 20;
  const boxY = yPos;

  const drawStatBox = (x: number, label: string, value: number, bgColor: [number, number, number], textColor: [number, number, number]) => {
    pdf.setFillColor(...bgColor);
    pdf.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...textColor);
    pdf.text(value.toString(), x + boxWidth / 2, boxY + 10, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, x + boxWidth / 2, boxY + 16, { align: 'center' });
  };

  drawStatBox(margin, 'Scannés', data.stats.total, [240, 240, 240], [50, 50, 50]);
  drawStatBox(margin + boxWidth + 5, 'Vérifiés', data.stats.verified, [220, 252, 231], [22, 101, 52]);
  drawStatBox(margin + (boxWidth + 5) * 2, 'Ajustés', data.stats.adjusted, [254, 243, 199], [161, 98, 7]);
  drawStatBox(margin + (boxWidth + 5) * 3, 'En attente', data.stats.pending + data.stats.pendingSync, [224, 231, 255], [55, 48, 163]);

  pdf.setTextColor(0, 0, 0);
  yPos = boxY + boxHeight + 15;

  // Pending sync warning
  if (data.stats.pendingSync > 0) {
    pdf.setFillColor(254, 226, 226);
    pdf.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(153, 27, 27);
    pdf.text(`⚠ ${data.stats.pendingSync} opération(s) en attente de synchronisation`, pageWidth / 2, yPos + 6, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPos += 15;
  }

  // Table header
  checkPageBreak(15);
  pdf.setFillColor(50, 50, 50);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Produit', margin + 3, yPos + 5);
  pdf.text('Code-barres', margin + 55, yPos + 5);
  pdf.text('Stock syst.', margin + 95, yPos + 5);
  pdf.text('Stock réel', margin + 120, yPos + 5);
  pdf.text('Écart', margin + 145, yPos + 5);
  pdf.text('Statut', margin + 165, yPos + 5);
  pdf.setTextColor(0, 0, 0);
  yPos += 10;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  data.scannedItems.forEach((item, idx) => {
    checkPageBreak(8);

    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
    }

    // Product name (truncate if needed)
    const maxNameLen = 25;
    const name = item.productName.length > maxNameLen 
      ? item.productName.substring(0, maxNameLen - 2) + '...' 
      : item.productName;
    pdf.text(name, margin + 3, yPos);

    // Barcode
    pdf.text(item.barcode || '-', margin + 55, yPos);

    // Expected stock
    pdf.text(`${item.expectedStock} ${item.stockUnit}`, margin + 95, yPos);

    // Actual stock
    const actualText = item.actualStock !== null ? `${item.actualStock} ${item.stockUnit}` : '-';
    pdf.text(actualText, margin + 120, yPos);

    // Difference
    if (item.actualStock !== null && item.adjusted) {
      const diff = item.actualStock - item.expectedStock;
      const diffText = diff > 0 ? `+${diff}` : diff.toString();
      pdf.setTextColor(diff === 0 ? 0 : diff > 0 ? 22 : 153, diff === 0 ? 0 : diff > 0 ? 101 : 27, diff === 0 ? 0 : diff > 0 ? 52 : 27);
      pdf.text(diffText, margin + 145, yPos);
      pdf.setTextColor(0, 0, 0);
    } else {
      pdf.text('-', margin + 145, yPos);
    }

    // Status
    let status = '';
    let statusColor: [number, number, number] = [100, 100, 100];
    if (item.pendingSync) {
      status = '⏳ Sync';
      statusColor = [161, 98, 7];
    } else if (item.adjusted) {
      status = '⚠ Ajusté';
      statusColor = [161, 98, 7];
    } else if (item.verified) {
      status = '✓ Vérifié';
      statusColor = [22, 101, 52];
    } else {
      status = '○ En attente';
      statusColor = [100, 100, 100];
    }
    pdf.setTextColor(...statusColor);
    pdf.text(status, margin + 165, yPos);
    pdf.setTextColor(0, 0, 0);

    yPos += 7;
  });

  // Summary
  yPos += 10;
  checkPageBreak(30);

  // Calculate discrepancy summary
  let totalPositive = 0;
  let totalNegative = 0;
  data.scannedItems.forEach(item => {
    if (item.actualStock !== null && item.adjusted) {
      const diff = item.actualStock - item.expectedStock;
      if (diff > 0) totalPositive += diff;
      else totalNegative += Math.abs(diff);
    }
  });

  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F');
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Résumé des écarts', margin + 5, yPos + 8);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(22, 101, 52);
  pdf.text(`Excédents: +${totalPositive}`, margin + 5, yPos + 16);
  pdf.setTextColor(153, 27, 27);
  pdf.text(`Manquants: -${totalNegative}`, margin + 60, yPos + 16);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Solde net: ${totalPositive - totalNegative >= 0 ? '+' : ''}${totalPositive - totalNegative}`, margin + 115, yPos + 16);

  yPos += 35;

  // Signature line
  checkPageBreak(25);
  pdf.setFontSize(9);
  pdf.text('Signature de l\'opérateur:', margin, yPos);
  pdf.line(margin + 45, yPos, margin + 100, yPos);
  pdf.text('Date:', margin + 110, yPos);
  pdf.line(margin + 120, yPos, margin + 165, yPos);

  // Footer
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Généré par ${companySettings.company_name} - ${new Date().toLocaleDateString('fr-FR')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save PDF
  const fileName = `inventaire_${data.sessionStart.toISOString().split('T')[0]}_${data.sessionEnd.toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
  pdf.save(fileName);
};