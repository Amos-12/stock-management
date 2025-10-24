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

const formatAmount = (amount: number, currency = true, compact = false): string => {
  const separator = compact ? '' : ' '; // No space in compact mode
  const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return currency ? `${formatted} HTG` : formatted;
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
  
  // Items header - responsive column positioning (4 columns with improved spacing)
  const qtyCol = width === 58 ? 22 : 32;   // Closer to article
  const priceCol = width === 58 ? 34 : 48; // Reasonable spacing
  const amountCol = width === 58 ? 52 : 72; // Aligned to the right with margin
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Article', margin, yPos);
  pdf.text('Qté', qtyCol, yPos);
  pdf.text('P.U.', priceCol, yPos);
  pdf.text('Montant', amountCol, yPos, { align: 'right' });
  yPos += 4;
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 4;
  
  // Items
  pdf.setFont('helvetica', 'normal');
  const maxNameLength = width === 58 ? 10 : 15; // Reduced to free up space for columns
  
  items.forEach(item => {
    // Build item description with details
    let itemDescription = item.name;
    if (item.category === 'fer' && item.diametre) {
      itemDescription = `${item.name} Ø${item.diametre}`;
      if (item.longueur_barre) {
        itemDescription += ` L:${item.longueur_barre}m`;
      }
    }
    
    const itemName = itemDescription.length > maxNameLength ? itemDescription.substring(0, maxNameLength - 2) + '..' : itemDescription;
    pdf.text(itemName, margin, yPos);
    
    // Quantity display - simplified to show only one unit type
    let qtyText = '';
    if (item.category === 'fer' && item.bars_per_ton) {
      const barsQty = Math.round(item.cartQuantity);
      if (item.sourceUnit === 'tonne') {
        // If input was in tonnes, display in tonnes only
        const tonnage = barresToTonnage(barsQty, item.bars_per_ton);
        qtyText = getTonnageLabel(tonnage);
      } else {
        // Otherwise, display in bars only
        qtyText = `${barsQty} barres`;
      }
    } else if (item.category === 'fer') {
      qtyText = `${Math.round(item.cartQuantity)} barres`;
    } else {
      qtyText = `${item.cartQuantity} ${item.displayUnit || item.unit}`;
    }
    
    pdf.text(qtyText, qtyCol, yPos);
    
    // Unit price
    const unitPrice = item.actualPrice ? item.actualPrice / item.cartQuantity : item.price;
    pdf.text(formatAmount(unitPrice, false, true), priceCol, yPos);
    
    // Item total
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    pdf.text(formatAmount(itemTotal, false, true), amountCol, yPos, { align: 'right' });
    yPos += 5;
    
    if (yPos > 270) {
      pdf.addPage([width, 297]);
      yPos = 10;
    }
  });
  
  yPos += 2;
  pdf.line(margin, yPos, width - margin, yPos);
  yPos += 5;
  
  // Totals
  pdf.setFont('helvetica', 'bold');
  pdf.text('Sous-total HT:', margin, yPos);
  pdf.text(formatAmount(saleData.subtotal, false, true), width - margin, yPos, { align: 'right' });
  yPos += 5;
  
  if (saleData.discount_amount > 0) {
    pdf.setFont('helvetica', 'normal');
    const discountLabel = saleData.discount_type === 'percentage' 
      ? `Remise (${saleData.discount_value}%):`
      : 'Remise:';
    pdf.text(discountLabel, margin, yPos);
    pdf.text(`-${formatAmount(saleData.discount_amount, false, true)}`, width - margin, yPos, { align: 'right' });
    yPos += 5;
  }
  
  // TVA
  pdf.setFont('helvetica', 'normal');
  const tvaAmount = saleData.total_amount * (companySettings.tva_rate / 100);
  pdf.text(`TVA (${companySettings.tva_rate}%):`, margin, yPos);
  pdf.text(formatAmount(tvaAmount, false, true), width - margin, yPos, { align: 'right' });
  yPos += 5;
  
  // Total TTC
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(titleFontSize - 1);
  pdf.text('TOTAL TTC:', margin, yPos);
  pdf.text(formatAmount(saleData.total_amount + tvaAmount, true, true), width - margin, yPos, { align: 'right' });
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
  
  // Table header
  pdf.setFillColor(240, 240, 240);
  pdf.rect(15, yPos, 180, 8, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Description', 17, yPos + 5);
  pdf.text('Qté', 120, yPos + 5, { align: 'right' });
  pdf.text('Unité', 140, yPos + 5, { align: 'right' });
  pdf.text('Prix unit.', 160, yPos + 5, { align: 'right' });
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
        itemDescription += ` - Longueur: ${item.longueur_barre}m`;
      }
    }
    
    pdf.text(itemDescription, 17, yPos);
    
    // Display quantity for iron products - ALWAYS show bars first
    let qtyDisplay = '';
    if (item.category === 'fer' && item.bars_per_ton) {
      const barsQty = Math.round(item.cartQuantity);
      if (item.sourceUnit === 'tonne') {
        const tonnage = barresToTonnage(barsQty, item.bars_per_ton);
        qtyDisplay = `${barsQty} barres (≈ ${getTonnageLabel(tonnage)})`;
      } else if (barsQty % item.bars_per_ton === 0) {
        const tonnes = barsQty / item.bars_per_ton;
        qtyDisplay = `${barsQty} barres (= ${tonnes} T)`;
      } else {
        qtyDisplay = `${barsQty} barres`;
      }
    } else if (item.category === 'fer') {
      qtyDisplay = `${Math.round(item.cartQuantity)} barres`;
    } else {
      qtyDisplay = item.cartQuantity.toString();
    }
    pdf.text(qtyDisplay, 120, yPos, { align: 'right' });
    
    // Unit column
    let unitText = item.displayUnit || item.unit;
    if (item.category === 'fer' && item.bars_per_ton) {
      unitText = ''; // Already included in quantity display
    } else if (item.category === 'fer' && item.unit === 'barre') {
      unitText = 'barre'; // Show unit for bars without bars_per_ton
    }
    pdf.text(unitText, 140, yPos, { align: 'right' });
    
    const unitPrice = item.actualPrice ? item.actualPrice / item.cartQuantity : item.price;
    pdf.text(formatAmount(unitPrice, false), 160, yPos, { align: 'right' });
    
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    pdf.text(formatAmount(itemTotal, false), 188, yPos, { align: 'right' });
    yPos += 6;
  });
  
  yPos += 5;
  pdf.line(15, yPos, 195, yPos);
  yPos += 8;
  
  // Totals
  pdf.setFont('helvetica', 'normal');
  pdf.text('Sous-total HT:', 140, yPos);
  pdf.text(formatAmount(saleData.subtotal, false), 188, yPos, { align: 'right' });
  yPos += 6;
  
  if (saleData.discount_amount > 0) {
    const discountLabel = saleData.discount_type === 'percentage'
      ? `Remise (${saleData.discount_value}%):`
      : 'Remise:';
    pdf.text(discountLabel, 140, yPos);
    pdf.text(`-${formatAmount(saleData.discount_amount, false)}`, 188, yPos, { align: 'right' });
    yPos += 6;
  }
  
  const tvaAmount = (saleData.total_amount - saleData.discount_amount) * (companySettings.tva_rate / 100);
  pdf.text(`TVA (${companySettings.tva_rate}%):`, 140, yPos);
  pdf.text(formatAmount(tvaAmount, false), 188, yPos, { align: 'right' });
  yPos += 8;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('TOTAL TTC:', 140, yPos);
  pdf.text(formatAmount(saleData.total_amount + tvaAmount), 188, yPos, { align: 'right' });
  yPos += 10;
  
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