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

const formatAmount = (amount: number, currency = true): string => {
  const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return currency ? `${formatted} HTG` : formatted;
};

export const generateReceipt = (
  saleData: SaleData,
  companySettings: CompanySettings,
  items: CartItem[],
  sellerName: string
) => {
  const pdf = new jsPDF({
    unit: 'mm',
    format: [80, 297],
    orientation: 'portrait'
  });

  pdf.setFont('helvetica', 'normal');
  let yPos = 10;
  
  // Add logo if available
  if (companySettings.logo_url) {
    try {
      const logoX = companySettings.logo_position_x || 25;
      const logoY = companySettings.logo_position_y || yPos;
      const logoW = companySettings.logo_width || 30;
      const logoH = companySettings.logo_height || 30;
      pdf.addImage(companySettings.logo_url, 'PNG', logoX, logoY, logoW, logoH);
      yPos += logoH + 5;
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }
  
  // Company name
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  const companyName = companySettings.company_name;
  const nameWidth = pdf.getTextWidth(companyName);
  pdf.text(companyName, (80 - nameWidth) / 2, yPos);
  yPos += 5;
  
  // Company description
  if (companySettings.company_description) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const descWidth = pdf.getTextWidth(companySettings.company_description);
    pdf.text(companySettings.company_description, (80 - descWidth) / 2, yPos);
    yPos += 4;
  }
  
  // Address
  pdf.setFontSize(8);
  const address = `${companySettings.address}, ${companySettings.city}`;
  const addressWidth = pdf.getTextWidth(address);
  pdf.text(address, (80 - addressWidth) / 2, yPos);
  yPos += 4;
  
  // Contact info
  const contact = `Tél: ${companySettings.phone}`;
  const contactWidth = pdf.getTextWidth(contact);
  pdf.text(contact, (80 - contactWidth) / 2, yPos);
  yPos += 4;
  
  const email = companySettings.email;
  const emailWidth = pdf.getTextWidth(email);
  pdf.text(email, (80 - emailWidth) / 2, yPos);
  yPos += 6;
  
  // Separator
  pdf.setLineWidth(0.3);
  pdf.line(5, yPos, 75, yPos);
  yPos += 5;
  
  // Receipt title
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  const receiptTitle = 'REÇU DE VENTE';
  const titleWidth = pdf.getTextWidth(receiptTitle);
  pdf.text(receiptTitle, (80 - titleWidth) / 2, yPos);
  yPos += 6;
  
  // Transaction details
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const date = new Date(saleData.created_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  pdf.text(`Date: ${date}`, 5, yPos);
  yPos += 4;
  pdf.text(`N° Reçu: ${saleData.id.substring(0, 8)}`, 5, yPos);
  yPos += 4;
  pdf.text(`Vendeur: ${sellerName}`, 5, yPos);
  yPos += 4;
  
  if (saleData.customer_name) {
    pdf.text(`Client: ${saleData.customer_name}`, 5, yPos);
    yPos += 4;
  }
  
  yPos += 2;
  pdf.line(5, yPos, 75, yPos);
  yPos += 5;
  
  // Items header
  pdf.setFont('helvetica', 'bold');
  pdf.text('Article', 5, yPos);
  pdf.text('Qté', 48, yPos);
  pdf.text('Montant', 60, yPos, { align: 'right' });
  yPos += 4;
  pdf.line(5, yPos, 75, yPos);
  yPos += 4;
  
  // Items
  pdf.setFont('helvetica', 'normal');
  items.forEach(item => {
    const itemName = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    pdf.text(itemName, 5, yPos);
    yPos += 3;
    
    // Quantity with fractional display for iron products
    let qtyText = '';
    if (item.category === 'fer' && item.unit === 'tonne') {
      qtyText = getTonnageLabel(item.cartQuantity);
    } else {
      qtyText = `${item.cartQuantity} ${item.displayUnit || item.unit}`;
    }
    
    pdf.text(qtyText, 48, yPos);
    
    const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
    pdf.text(formatAmount(itemTotal, false), 75, yPos, { align: 'right' });
    yPos += 5;
    
    if (yPos > 270) {
      pdf.addPage([80, 297]);
      yPos = 10;
    }
  });
  
  yPos += 2;
  pdf.line(5, yPos, 75, yPos);
  yPos += 5;
  
  // Totals
  pdf.setFont('helvetica', 'bold');
  pdf.text('Sous-total HT:', 5, yPos);
  pdf.text(formatAmount(saleData.subtotal, false), 75, yPos, { align: 'right' });
  yPos += 5;
  
  if (saleData.discount_amount > 0) {
    pdf.setFont('helvetica', 'normal');
    const discountLabel = saleData.discount_type === 'percentage' 
      ? `Remise (${saleData.discount_value}%):`
      : 'Remise:';
    pdf.text(discountLabel, 5, yPos);
    pdf.text(`-${formatAmount(saleData.discount_amount, false)}`, 75, yPos, { align: 'right' });
    yPos += 5;
  }
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('TOTAL:', 5, yPos);
  pdf.text(formatAmount(saleData.total_amount), 75, yPos, { align: 'right' });
  yPos += 6;
  
  // Payment method
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const methodLabels: Record<string, string> = {
    'espece': 'Espèces',
    'cheque': 'Chèque',
    'virement': 'Virement'
  };
  pdf.text(`Mode de paiement: ${methodLabels[saleData.payment_method] || saleData.payment_method}`, 5, yPos);
  yPos += 6;
  
  pdf.line(5, yPos, 75, yPos);
  yPos += 5;
  
  // Thank you message
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'italic');
  const thanks = 'Merci de votre confiance !';
  const thanksWidth = pdf.getTextWidth(thanks);
  pdf.text(thanks, (80 - thanksWidth) / 2, yPos);
  
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
  pdf.text(`N° Facture: ${saleData.id.substring(0, 8).toUpperCase()}`, 15, yPos + 6);
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
    
    pdf.text(item.name, 17, yPos);
    pdf.text(item.cartQuantity.toString(), 120, yPos, { align: 'right' });
    
    // Use fractional display for iron products
    let unitText = item.displayUnit || item.unit;
    if (item.category === 'fer' && item.unit === 'tonne') {
      unitText = 'tonne';
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