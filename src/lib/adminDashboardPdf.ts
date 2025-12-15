import jsPDF from 'jspdf';

interface DashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayProfit: number;
  todaySales: number;
  avgBasket: number;
  totalProducts: number;
  totalSellers: number;
  lowStockCount: number;
  profitMargin: number;
}

interface TopProduct {
  name: string;
  revenue: number;
  sales?: number;
  percent?: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface SellerData {
  name: string;
  sales: number;
  revenue: number;
}

interface CompanySettings {
  company_name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo_url?: string;
  usd_htg_rate?: number;
  tva_rate?: number;
  company_description?: string;
  payment_terms?: string;
}

// Helper function to format numbers with space as thousand separator
const formatNumber = (num: number, decimals = 0): string => {
  const fixed = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${formattedInt}.${decPart}` : formattedInt;
};

export const generateAdminDashboardPdf = async (
  stats: DashboardStats,
  topProducts: TopProduct[],
  categoryData: CategoryData[],
  topSellers: SellerData[],
  companySettings: CompanySettings,
  period: string = 'Journalier'
): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const successColor: [number, number, number] = [34, 197, 94]; // Green
  const warningColor: [number, number, number] = [234, 179, 8]; // Yellow
  const accentColor: [number, number, number] = [139, 92, 246]; // Purple
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Helper to draw rounded rectangle
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill?: [number, number, number], stroke?: boolean) => {
    if (fill) {
      pdf.setFillColor(fill[0], fill[1], fill[2]);
    }
    if (stroke) {
      pdf.setDrawColor(200, 200, 200);
    }
    pdf.roundedRect(x, y, w, h, r, r, fill && stroke ? 'FD' : fill ? 'F' : 'S');
  };

  // ===== HEADER WITH COMPANY INFO =====
  drawRoundedRect(0, 0, pageWidth, 55, 0, primaryColor);
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TABLEAU DE BORD ADMINISTRATEUR', pageWidth / 2, 16, { align: 'center' });
  
  // Company name prominent
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.company_name.toUpperCase(), pageWidth / 2, 28, { align: 'center' });
  
  // Company details
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const companyLine1 = `${companySettings.address} - ${companySettings.city}`;
  pdf.text(companyLine1, pageWidth / 2, 36, { align: 'center' });
  
  const companyLine2 = `Tel: ${companySettings.phone} | Email: ${companySettings.email}`;
  pdf.text(companyLine2, pageWidth / 2, 42, { align: 'center' });
  
  // Generation date
  pdf.setFontSize(8);
  const dateStr = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  pdf.text(`Rapport généré le ${dateStr}`, pageWidth / 2, 50, { align: 'center' });

  yPos = 65;

  // ===== PERIOD & EXCHANGE RATE BADGES =====
  const periodText = `Période: ${period}`;
  pdf.setFontSize(10);
  const periodWidth = pdf.getTextWidth(periodText) + 12;
  drawRoundedRect(margin, yPos, periodWidth, 8, 2, [239, 246, 255]);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text(periodText, margin + 6, yPos + 5.5);
  
  // Exchange rate and TVA
  if (companySettings.usd_htg_rate) {
    const rateText = `Taux: 1 USD = ${formatNumber(companySettings.usd_htg_rate, 2)} HTG`;
    const rateWidth = pdf.getTextWidth(rateText) + 12;
    drawRoundedRect(pageWidth - margin - rateWidth, yPos, rateWidth, 8, 2, [236, 253, 245]);
    pdf.setTextColor(successColor[0], successColor[1], successColor[2]);
    pdf.text(rateText, pageWidth - margin - rateWidth + 6, yPos + 5.5);
  }

  // TVA badge
  if (companySettings.tva_rate) {
    const tvaText = `TVA: ${companySettings.tva_rate}%`;
    const tvaWidth = pdf.getTextWidth(tvaText) + 12;
    drawRoundedRect(margin + periodWidth + 5, yPos, tvaWidth, 8, 2, [254, 243, 199]);
    pdf.setTextColor(warningColor[0], warningColor[1], warningColor[2]);
    pdf.text(tvaText, margin + periodWidth + 11, yPos + 5.5);
  }

  yPos += 18;

  // ===== KPI CARDS =====
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Indicateurs Clés de Performance', margin, yPos);
  yPos += 8;

  const kpiCardWidth = (pageWidth - margin * 2 - 12) / 4;
  const kpiCardHeight = 28;
  
  const kpis = [
    { label: "Revenus Aujourd'hui", value: stats.todayRevenue, color: primaryColor, suffix: 'HTG' },
    { label: "Bénéfices Aujourd'hui", value: stats.todayProfit, color: successColor, suffix: 'HTG' },
    { label: "Revenus Semaine", value: stats.weekRevenue, color: accentColor, suffix: 'HTG' },
    { label: "Revenus Mois", value: stats.monthRevenue, color: warningColor, suffix: 'HTG' },
  ];

  kpis.forEach((kpi, index) => {
    const x = margin + index * (kpiCardWidth + 4);
    drawRoundedRect(x, yPos, kpiCardWidth, kpiCardHeight, 4, [250, 250, 252], true);
    
    // Left accent line
    pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    pdf.roundedRect(x, yPos, 3, kpiCardHeight, 2, 2, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    pdf.text(kpi.label, x + 8, yPos + 8);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    pdf.text(`${formatNumber(kpi.value)} ${kpi.suffix}`, x + 8, yPos + 18);
  });

  yPos += kpiCardHeight + 8;

  // Second row of KPIs
  const kpis2 = [
    { label: "Ventes Aujourd'hui", value: stats.todaySales, color: [249, 115, 22] as [number, number, number], suffix: '' },
    { label: "Panier Moyen", value: stats.avgBasket, color: [6, 182, 212] as [number, number, number], suffix: 'HTG' },
    { label: "Produits Actifs", value: stats.totalProducts, color: [14, 165, 233] as [number, number, number], suffix: '' },
    { label: "Alertes Stock", value: stats.lowStockCount, color: [239, 68, 68] as [number, number, number], suffix: '' },
  ];

  kpis2.forEach((kpi, index) => {
    const x = margin + index * (kpiCardWidth + 4);
    drawRoundedRect(x, yPos, kpiCardWidth, kpiCardHeight, 4, [250, 250, 252], true);
    
    pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    pdf.roundedRect(x, yPos, 3, kpiCardHeight, 2, 2, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    pdf.text(kpi.label, x + 8, yPos + 8);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    const valueText = kpi.suffix ? `${formatNumber(kpi.value)} ${kpi.suffix}` : formatNumber(kpi.value);
    pdf.text(valueText, x + 8, yPos + 18);
  });

  yPos += kpiCardHeight + 15;

  // ===== TOP 10 PRODUCTS =====
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Top 10 Produits par Revenus', margin, yPos);
  yPos += 8;

  const totalProductRevenue = topProducts.reduce((sum, p) => sum + p.revenue, 0);
  const tableWidth = pageWidth - margin * 2;
  
  // Table header
  drawRoundedRect(margin, yPos, tableWidth, 8, 2, [241, 245, 249]);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  pdf.text('#', margin + 5, yPos + 5.5);
  pdf.text('Produit', margin + 15, yPos + 5.5);
  pdf.text('Revenus', margin + tableWidth - 60, yPos + 5.5);
  pdf.text('%', margin + tableWidth - 15, yPos + 5.5);
  yPos += 10;

  topProducts.slice(0, 10).forEach((product, index) => {
    const percent = totalProductRevenue > 0 ? ((product.revenue / totalProductRevenue) * 100).toFixed(1) : '0';
    const bgColor: [number, number, number] = index % 2 === 0 ? [255, 255, 255] : [250, 250, 252];
    drawRoundedRect(margin, yPos, tableWidth, 7, 0, bgColor);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    pdf.text(`${index + 1}`, margin + 5, yPos + 5);
    
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    const productName = product.name.length > 35 ? product.name.substring(0, 35) + '...' : product.name;
    pdf.text(productName, margin + 15, yPos + 5);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumber(product.revenue)} HTG`, margin + tableWidth - 60, yPos + 5);
    
    pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    pdf.text(`${percent}%`, margin + tableWidth - 15, yPos + 5);
    
    yPos += 7;
  });

  yPos += 10;

  // ===== TOP 5 SELLERS =====
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Top 5 Vendeurs', margin, yPos);
  yPos += 8;

  const totalSellerRevenue = topSellers.reduce((sum, s) => sum + s.revenue, 0);

  // Table header
  drawRoundedRect(margin, yPos, tableWidth, 8, 2, [241, 245, 249]);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  pdf.text('#', margin + 5, yPos + 5.5);
  pdf.text('Vendeur', margin + 15, yPos + 5.5);
  pdf.text('Ventes', margin + 90, yPos + 5.5);
  pdf.text('Revenus', margin + tableWidth - 60, yPos + 5.5);
  pdf.text('%', margin + tableWidth - 15, yPos + 5.5);
  yPos += 10;

  topSellers.slice(0, 5).forEach((seller, index) => {
    const percent = totalSellerRevenue > 0 ? ((seller.revenue / totalSellerRevenue) * 100).toFixed(1) : '0';
    const bgColor: [number, number, number] = index % 2 === 0 ? [255, 255, 255] : [250, 250, 252];
    drawRoundedRect(margin, yPos, tableWidth, 7, 0, bgColor);
    
    // Rank with medal colors for top 3
    const rankColors: [number, number, number][] = [
      [234, 179, 8], // Gold
      [156, 163, 175], // Silver
      [180, 83, 9], // Bronze
    ];
    if (index < 3) {
      pdf.setTextColor(rankColors[index][0], rankColors[index][1], rankColors[index][2]);
    } else {
      pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(`${index + 1}`, margin + 5, yPos + 5);
    
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    pdf.setFont('helvetica', 'normal');
    pdf.text(seller.name, margin + 15, yPos + 5);
    
    pdf.text(`${seller.sales}`, margin + 90, yPos + 5);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumber(seller.revenue)} HTG`, margin + tableWidth - 60, yPos + 5);
    
    pdf.setTextColor([236, 72, 153][0], [236, 72, 153][1], [236, 72, 153][2]);
    pdf.text(`${percent}%`, margin + tableWidth - 15, yPos + 5);
    
    yPos += 7;
  });

  yPos += 10;

  // ===== CATEGORY DISTRIBUTION =====
  if (yPos > pageHeight - 70) {
    pdf.addPage();
    yPos = margin;
  }

  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Répartition par Catégorie', margin, yPos);
  yPos += 8;

  const totalCategoryValue = categoryData.reduce((sum, c) => sum + c.value, 0);
  const categoryColors: [number, number, number][] = [
    [59, 130, 246], [34, 197, 94], [245, 158, 11], [239, 68, 68],
    [139, 92, 246], [6, 182, 212], [236, 72, 153], [132, 204, 22]
  ];

  categoryData.forEach((cat, index) => {
    const percent = totalCategoryValue > 0 ? ((cat.value / totalCategoryValue) * 100) : 0;
    const barWidth = (percent / 100) * (tableWidth - 80);
    const color = categoryColors[index % categoryColors.length];
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    const catName = cat.name.length > 20 ? cat.name.substring(0, 20) + '...' : cat.name;
    pdf.text(catName, margin, yPos + 4);
    
    // Progress bar background
    drawRoundedRect(margin + 50, yPos, tableWidth - 80, 6, 2, [241, 245, 249]);
    // Progress bar fill
    if (barWidth > 2) {
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.roundedRect(margin + 50, yPos, barWidth, 6, 2, 2, 'F');
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${cat.value} (${percent.toFixed(0)}%)`, margin + tableWidth - 25, yPos + 4);
    
    yPos += 9;
  });

  // ===== SUMMARY BOX =====
  yPos += 5;
  drawRoundedRect(margin, yPos, tableWidth, 30, 4, [241, 245, 249], true);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.text('Résumé des Performances', margin + 8, yPos + 8);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  
  const summaryItems = [
    `Marge bénéficiaire: ${stats.profitMargin.toFixed(1)}%`,
    `Produits en alerte: ${stats.lowStockCount}`,
    `Total produits: ${formatNumber(stats.totalProducts)}`,
  ];
  
  summaryItems.forEach((item, index) => {
    pdf.text(item, margin + 8 + (index * 62), yPos + 18);
  });

  // Vendeurs actifs
  pdf.text(`Vendeurs actifs: ${stats.totalSellers}`, margin + 8, yPos + 26);

  // ===== FOOTER WITH COMPANY INFO =====
  const footerY = pageHeight - 18;
  
  // Footer background
  drawRoundedRect(0, footerY - 8, pageWidth, 26, 0, [241, 245, 249]);
  
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, footerY - 6, pageWidth - margin, footerY - 6);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.text(companySettings.company_name, margin, footerY);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  pdf.text(`${companySettings.address}, ${companySettings.city}`, margin, footerY + 5);
  pdf.text(`${companySettings.phone} | ${companySettings.email}`, margin, footerY + 10);
  
  // Page number
  pdf.text(`Page 1/1`, pageWidth - margin, footerY + 5, { align: 'right' });
  
  // Description or terms if available
  if (companySettings.company_description) {
    pdf.setFontSize(7);
    pdf.text(companySettings.company_description.substring(0, 80), pageWidth / 2, footerY + 10, { align: 'center' });
  }

  // Save the PDF
  const fileName = `dashboard-admin-${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};
