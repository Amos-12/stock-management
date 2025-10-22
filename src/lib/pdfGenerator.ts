import jsPDF from 'jspdf';

interface CompanySettings {
  company_name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo_url?: string;
  logo_position_x?: number;
  logo_position_y?: number;
  logo_width?: number;
  logo_height?: number;
  tva_rate: number;
  payment_terms?: string;
}

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit?: string;
  category?: string;
  bars_per_ton?: number;
}

interface SaleData {
  id: string;
  customer_name?: string;
  customer_address?: string;
  total_amount: number;
  subtotal: number;
  discount_amount?: number;
  payment_method: string;
  created_at: string;
  seller_name: string;
  items: SaleItem[];
}

const getFractionLabel = (tonnage: number): string => {
  const whole = Math.floor(tonnage);
  const decimal = tonnage - whole;
  
  const fractions: Record<number, string> = {
    0.25: '1/4',
    0.5: '1/2',
    0.75: '3/4'
  };
  
  const roundedDecimal = Math.round(decimal * 100) / 100;
  const fractionPart = fractions[roundedDecimal];
  
  if (decimal === 0) return `${whole} tonne${whole > 1 ? 's' : ''}`;
  if (!fractionPart) return `${tonnage.toFixed(2)} tonne${tonnage > 1 ? 's' : ''}`;
  if (whole === 0) return `${fractionPart} tonne`;
  return `${whole} ${fractionPart} tonne${tonnage > 1 ? 's' : ''}`;
};

const calculateTonnage = (bars: number, barsPerTon: number) => {
  const tonnage = bars / barsPerTon;
  const standardTonnages = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const match = standardTonnages.find(t => Math.abs(tonnage - t) < 0.01);
  
  return {
    tonnage,
    isStandard: !!match,
    standardValue: match,
    formatted: match ? `${match}T` : `${tonnage.toFixed(3)}T`
  };
};

export const generateReceipt = async (saleData: SaleData, companySettings: CompanySettings) => {
  const doc = new jsPDF({
    format: [80, 297],
    unit: 'mm'
  });

  let yPos = 10;
  
  if (companySettings.logo_url) {
    try {
      const logoX = companySettings.logo_position_x || 25;
      const logoY = companySettings.logo_position_y || yPos;
      const logoW = companySettings.logo_width || 30;
      const logoH = companySettings.logo_height || 30;
      
      doc.addImage(companySettings.logo_url, 'PNG', logoX, logoY, logoW, logoH);
      yPos = logoY + logoH + 5;
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(companySettings.company_name, 40, yPos, { align: 'center' });
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(companySettings.address, 40, yPos, { align: 'center' });
  yPos += 4;
  doc.text(companySettings.city, 40, yPos, { align: 'center' });
  yPos += 4;
  doc.text(`Tél: ${companySettings.phone}`, 40, yPos, { align: 'center' });
  yPos += 4;
  doc.text(`Email: ${companySettings.email}`, 40, yPos, { align: 'center' });
  yPos += 6;

  doc.setLineWidth(0.5);
  doc.line(5, yPos, 75, yPos);
  yPos += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('REÇU DE VENTE', 40, yPos, { align: 'center' });
  yPos += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const saleDate = new Date(saleData.created_at);
  doc.text(`Date: ${saleDate.toLocaleDateString('fr-FR')} ${saleDate.toLocaleTimeString('fr-FR')}`, 5, yPos);
  yPos += 4;
  doc.text(`Reçu N°: ${saleData.id.substring(0, 8)}`, 5, yPos);
  yPos += 4;
  doc.text(`Vendeur: ${saleData.seller_name}`, 5, yPos);
  yPos += 6;

  if (saleData.customer_name) {
    doc.text(`Client: ${saleData.customer_name}`, 5, yPos);
    yPos += 4;
  }

  doc.line(5, yPos, 75, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('ARTICLES', 5, yPos);
  yPos += 4;
  doc.setFont('helvetica', 'normal');

  saleData.items.forEach((item) => {
    let displayQty = item.quantity;
    let displayUnit = item.unit || 'unité';
    let displayPrice = item.unit_price;

    if (item.category === 'fer' && item.bars_per_ton) {
      const tonnageInfo = calculateTonnage(item.quantity, item.bars_per_ton);
      if (tonnageInfo.isStandard && tonnageInfo.standardValue) {
        displayQty = tonnageInfo.standardValue;
        displayUnit = getFractionLabel(tonnageInfo.standardValue);
        displayPrice = item.unit_price * item.bars_per_ton;
      }
    }

    const itemName = item.product_name.length > 30 
      ? item.product_name.substring(0, 27) + '...' 
      : item.product_name;
    
    doc.text(itemName, 5, yPos);
    yPos += 4;
    
    doc.text(`  ${displayQty} ${displayUnit} x ${displayPrice.toFixed(2)} HTG`, 5, yPos);
    yPos += 4;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.subtotal.toFixed(2)} HTG`, 75, yPos - 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    
    yPos += 2;

    if (yPos > 270) {
      doc.addPage();
      yPos = 10;
    }
  });

  yPos += 2;
  doc.line(5, yPos, 75, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Sous-total:', 5, yPos);
  doc.text(`${saleData.subtotal.toFixed(2)} HTG`, 75, yPos, { align: 'right' });
  yPos += 5;

  if (saleData.discount_amount && saleData.discount_amount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Remise:', 5, yPos);
    doc.text(`-${saleData.discount_amount.toFixed(2)} HTG`, 75, yPos, { align: 'right' });
    yPos += 5;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 5, yPos);
  doc.text(`${saleData.total_amount.toFixed(2)} HTG`, 75, yPos, { align: 'right' });
  yPos += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const paymentMethodText = saleData.payment_method === 'cash' ? 'Espèces' : 
                           saleData.payment_method === 'card' ? 'Carte' : 'Crédit';
  doc.text(`Mode de paiement: ${paymentMethodText}`, 5, yPos);
  yPos += 6;

  doc.line(5, yPos, 75, yPos);
  yPos += 5;

  doc.setFontSize(7);
  doc.text('Merci pour votre visite!', 40, yPos, { align: 'center' });
  
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
};

export const generateInvoice = async (saleData: SaleData, companySettings: CompanySettings) => {
  const doc = new jsPDF();
  
  let yPos = 20;
  
  if (companySettings.logo_url) {
    try {
      const logoX = companySettings.logo_position_x || 15;
      const logoY = companySettings.logo_position_y || 15;
      const logoW = companySettings.logo_width || 40;
      const logoH = companySettings.logo_height || 40;
      
      doc.addImage(companySettings.logo_url, 'PNG', logoX, logoY, logoW, logoH);
      yPos = Math.max(yPos, logoY + logoH + 10);
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 150, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const saleDate = new Date(saleData.created_at);
  doc.text(`Date: ${saleDate.toLocaleDateString('fr-FR')}`, 150, 40);
  doc.text(`Facture N°: ${saleData.id.substring(0, 8).toUpperCase()}`, 150, 47);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(companySettings.company_name, 15, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(companySettings.address, 15, yPos);
  yPos += 5;
  doc.text(companySettings.city, 15, yPos);
  yPos += 5;
  doc.text(`Tél: ${companySettings.phone}`, 15, yPos);
  yPos += 5;
  doc.text(`Email: ${companySettings.email}`, 15, yPos);
  yPos += 15;

  if (saleData.customer_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURÉ À:', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(saleData.customer_name, 15, yPos);
    yPos += 5;
    if (saleData.customer_address) {
      doc.text(saleData.customer_address, 15, yPos);
      yPos += 5;
    }
  }

  yPos += 10;

  const tableTop = yPos;
  const col1 = 15;
  const col2 = 90;
  const col3 = 120;
  const col4 = 150;
  const col5 = 180;

  doc.setFillColor(240, 240, 240);
  doc.rect(col1, tableTop, 180, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Description', col1 + 2, tableTop + 5);
  doc.text('Qté', col2 + 2, tableTop + 5);
  doc.text('Unité', col3 + 2, tableTop + 5);
  doc.text('Prix unit.', col4 + 2, tableTop + 5);
  doc.text('Montant', col5 + 2, tableTop + 5);

  yPos = tableTop + 12;
  doc.setFont('helvetica', 'normal');

  saleData.items.forEach((item) => {
    let displayQty = item.quantity;
    let displayUnit = item.unit || 'unité';
    let displayPrice = item.unit_price;

    if (item.category === 'fer' && item.bars_per_ton) {
      const tonnageInfo = calculateTonnage(item.quantity, item.bars_per_ton);
      if (tonnageInfo.isStandard && tonnageInfo.standardValue) {
        displayQty = tonnageInfo.standardValue;
        displayUnit = getFractionLabel(tonnageInfo.standardValue);
        displayPrice = item.unit_price * item.bars_per_ton;
      }
    }

    doc.text(item.product_name, col1 + 2, yPos);
    doc.text(displayQty.toString(), col2 + 2, yPos);
    doc.text(displayUnit, col3 + 2, yPos);
    doc.text(`${displayPrice.toFixed(2)} HTG`, col4 + 2, yPos);
    doc.text(`${item.subtotal.toFixed(2)} HTG`, col5 + 2, yPos);
    
    yPos += 7;

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
  });

  yPos += 5;
  doc.line(15, yPos, 195, yPos);
  yPos += 8;

  doc.text('Sous-total HT:', 150, yPos);
  doc.text(`${saleData.subtotal.toFixed(2)} HTG`, 195, yPos, { align: 'right' });
  yPos += 7;

  if (saleData.discount_amount && saleData.discount_amount > 0) {
    doc.text('Remise:', 150, yPos);
    doc.text(`-${saleData.discount_amount.toFixed(2)} HTG`, 195, yPos, { align: 'right' });
    yPos += 7;
  }

  const subtotalAfterDiscount = saleData.subtotal - (saleData.discount_amount || 0);
  const tvaAmount = (subtotalAfterDiscount * companySettings.tva_rate) / 100;
  
  doc.text(`TVA (${companySettings.tva_rate}%):`, 150, yPos);
  doc.text(`${tvaAmount.toFixed(2)} HTG`, 195, yPos, { align: 'right' });
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL TTC:', 150, yPos);
  doc.text(`${saleData.total_amount.toFixed(2)} HTG`, 195, yPos, { align: 'right' });
  yPos += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const paymentMethodText = saleData.payment_method === 'cash' ? 'Espèces' : 
                           saleData.payment_method === 'card' ? 'Carte bancaire' : 'Crédit';
  doc.text(`Mode de paiement: ${paymentMethodText}`, 15, yPos);
  yPos += 10;

  if (companySettings.payment_terms) {
    doc.setFontSize(9);
    doc.text('Conditions de paiement:', 15, yPos);
    yPos += 5;
    doc.text(companySettings.payment_terms, 15, yPos);
  }

  yPos = 270;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Merci pour votre confiance', 105, yPos, { align: 'center' });

  doc.save(`facture_${saleData.id.substring(0, 8)}.pdf`);
};
