import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Download, Printer, Mail } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

interface InvoiceItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceData {
  customer_name: string;
  customer_email?: string;
  customer_address?: string;
  items: InvoiceItem[];
  total_amount: number;
  payment_method: string;
  date: string;
  invoice_number: string;
}

interface InvoiceGeneratorProps {
  saleData?: {
    id: string;
    customer_name?: string;
    total_amount: number;
    payment_method: string;
    created_at: string;
    items?: Array<{
      name: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>;
  };
}

export const InvoiceGenerator = ({ saleData }: InvoiceGeneratorProps) => {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    customer_name: saleData?.customer_name || '',
    customer_email: '',
    customer_address: '',
    items: saleData?.items || [],
    total_amount: saleData?.total_amount || 0,
    payment_method: saleData?.payment_method || 'cash',
    date: saleData?.created_at ? new Date(saleData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    invoice_number: `INV-${Date.now()}`
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    try {
      setIsGenerating(true);

      // Format 58mm largeur pour imprimante thermique borlette
      const receiptWidth = 58; // mm
      
      // Calculer hauteur dynamique basée sur le contenu réel
      const headerHeight = 30; // En-tête avec logo et info
      const itemsHeight = invoiceData.items.length * 8; // ~8mm par item
      const footerHeight = 25; // Total et footer
      const dynamicHeight = headerHeight + itemsHeight + footerHeight;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [receiptWidth, dynamicHeight]
      });

      const margin = 3;
      const contentWidth = receiptWidth - (margin * 2);
      let currentY = margin;

      // Logo SVG - Centré en haut
      const logoSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect x="10" y="10" width="80" height="80" rx="10" fill="#2255aa"/>
          <text x="50" y="65" font-size="45" font-weight="bold" text-anchor="middle" fill="white">GF</text>
        </svg>
      `;
      
      currentY += 5;
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GF', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Company Header - Compact
      currentY += 4;
      pdf.setFontSize(8);
      pdf.text('GF DISTRIBUTION & MULTI-SERVICES', contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 2;
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Aux Cayes, Sud, Haïti', contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 2.5;
      pdf.text('Tel: +509 3134-3213', contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 2.5;
      pdf.text('contact@gfdistribution.com', contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Invoice Info - Compact
      currentY += 4;
      pdf.setFontSize(7);
      pdf.text(`No: ${invoiceData.invoice_number.substring(0, 15)}`, margin, currentY);
      currentY += 3;
      pdf.text(`Date: ${invoiceData.date}`, margin, currentY);
      
      if (invoiceData.customer_name) {
        currentY += 3;
        pdf.text(`Client: ${invoiceData.customer_name.substring(0, 20)}`, margin, currentY);
      }
      
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Items - Very Compact Format
      currentY += 4;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Article', margin, currentY);
      pdf.text('Qte', contentWidth - 30, currentY);
      pdf.text('Prix', contentWidth - 20, currentY);
      pdf.text('Total', contentWidth - 1, currentY, { align: 'right' });
      
      currentY += 2;
      pdf.setFont('helvetica', 'normal');
      
      invoiceData.items.forEach((item) => {
        currentY += 3;
        
        // Truncate long names
        const itemName = item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name;
        pdf.setFontSize(6);
        pdf.text(itemName, margin, currentY);
        
        pdf.text(item.quantity.toString(), contentWidth - 30, currentY);
        pdf.text(`${item.unit_price.toFixed(2)}`, contentWidth - 20, currentY);
        pdf.text(`${item.total.toFixed(2)}`, contentWidth - 2 + margin, currentY, { align: 'right' });
      });
      
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Total - Bold and Larger
      currentY += 4;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL:', margin, currentY);
      pdf.text(`${invoiceData.total_amount.toFixed(2)} HTG`, contentWidth - 2 + margin, currentY, { align: 'right' });
      
      currentY += 4;
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Paiement: ${invoiceData.payment_method.toUpperCase()}`, margin, currentY);
      
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Footer - Very Small
      currentY += 3;
      pdf.setFontSize(5);
      pdf.text('Merci de votre visite!', contentWidth / 2 + margin, currentY, { align: 'center'});

      // Save/Print the PDF
      const fileName = `recu_${invoiceData.invoice_number}.pdf`;
      pdf.save(fileName);

      // Auto-print
      setTimeout(() => {
        window.print();
      }, 500);

      toast({
        title: "Reçu généré",
        description: "Le reçu thermique 58x80mm a été créé"
      });

    } catch (error) {
      console.error('Error generating thermal receipt:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const previewInvoice = () => {
    // Open a new window with invoice preview
    const previewWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!previewWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta charset="UTF-8">
        <title>Aperçu Facture - ${invoiceData.invoice_number}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 20px; padding: 0; color: #333; max-width: 100%; overflow-x: hidden; }
          @media (max-width: 768px) {
            body { margin: 10px; font-size: 14px; }
          }
          .logo { width: 60px; height: 60px; margin: 0 auto 15px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2255aa; padding-bottom: 20px; }
          .company-name { color: #2255aa; font-size: 24px; font-weight: bold; margin: 10px 0 0; }
          .company-info { color: #666; font-size: 11px; margin-top: 10px; line-height: 1.4; }
          .invoice-info { text-align: right; margin-bottom: 25px; }
          .customer-info { margin-bottom: 25px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 25px; overflow-x: auto; }
          .table th { background-color: #2255aa; color: white; padding: 8px; text-align: left; font-size: 12px; }
          .table td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
          .table tr:nth-child(even) { background-color: #f9f9f9; }
          .total-section { text-align: right; margin-top: 20px; }
          .total-box { background-color: #2255aa; color: white; padding: 12px 20px; display: inline-block; margin-left: auto; border-radius: 4px; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px; }
          @media (max-width: 600px) {
            .company-name { font-size: 20px; }
            .table th, .table td { padding: 5px; font-size: 11px; }
            .total-box { padding: 10px 15px; }
          }
          @media print {
            body { margin: 0; }
            .footer { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" rx="10" fill="#2255aa"/>
            <text x="50" y="65" font-size="45" font-weight="bold" text-anchor="middle" fill="white">GF</text>
          </svg>
          <h1 class="company-name">GF DISTRIBUTION & MULTI-SERVICES</h1>
          <div class="company-info">
            Système de gestion des ventes<br>
            Aux Cayes, Sud, Haïti<br>
            Tél: +509 3134-3213 | Email: contact@gfdistribution.com
          </div>
        </div>

        <div class="invoice-info">
          <h2>FACTURE</h2>
          <p><strong>N° ${invoiceData.invoice_number}</strong></p>
          <p>Date: ${invoiceData.date}</p>
        </div>

        <div class="customer-info">
          <h3>Facturé à:</h3>
          <p><strong>${invoiceData.customer_name || 'Client'}</strong></p>
          ${invoiceData.customer_email ? `<p>${invoiceData.customer_email}</p>` : ''}
          ${invoiceData.customer_address ? `<p>${invoiceData.customer_address}</p>` : ''}
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantité</th>
              <th>Prix Unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceData.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.unit_price.toFixed(2)} HTG</td>
                <td>${item.total.toFixed(2)} HTG</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <strong>TOTAL: ${invoiceData.total_amount.toFixed(2)} HTG</strong>
          </div>
        </div>

        <p style="margin-top: 30px;"><strong>Mode de paiement:</strong> ${invoiceData.payment_method.toUpperCase()}</p>

        <div class="footer">
          <p>Merci pour votre confiance !</p>
          <p>GF Distribution - Tous droits réservés</p>
        </div>
      </body>
      </html>
    `;

    previewWindow.document.write(htmlContent);
    previewWindow.document.close();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="hover:bg-primary/10">
          <FileText className="w-4 h-4 mr-2" />
          Générer Facture
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Générateur de Facture
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom du client</label>
              <Input
                value={invoiceData.customer_name}
                onChange={(e) => setInvoiceData(prev => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Nom du client"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email (optionnel)</label>
              <Input
                type="email"
                value={invoiceData.customer_email}
                onChange={(e) => setInvoiceData(prev => ({ ...prev, customer_email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Adresse (optionnelle)</label>
            <Textarea
              value={invoiceData.customer_address}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, customer_address: e.target.value }))}
              placeholder="Adresse du client"
              rows={2}
            />
          </div>

          {/* Invoice Details */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h3 className="font-medium mb-3">Détails de la facture</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">N° de facture:</span>
                <div className="font-mono">{invoiceData.invoice_number}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <div>{invoiceData.date}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>
                <div className="font-semibold text-success">{invoiceData.total_amount.toFixed(2)} HTG</div>
              </div>
              <div>
                <span className="text-muted-foreground">Paiement:</span>
                <div className="capitalize">{invoiceData.payment_method}</div>
              </div>
            </div>
          </div>

          {/* Items Preview */}
          <div className="space-y-2">
            <h3 className="font-medium">Articles ({invoiceData.items.length})</h3>
            <div className="max-h-40 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Produit</th>
                    <th className="text-right p-2">Qté</th>
                    <th className="text-right p-2">Prix</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{item.name}</td>
                      <td className="text-right p-2">{item.quantity}</td>
                      <td className="text-right p-2">{item.unit_price.toFixed(2)} HTG</td>
                      <td className="text-right p-2">{item.total.toFixed(2)} HTG</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              onClick={previewInvoice}
              variant="outline"
              className="hover:bg-primary/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              Aperçu
            </Button>
            <Button
              onClick={generatePDF}
              disabled={isGenerating || !invoiceData.customer_name}
              className="bg-primary hover:bg-primary-hover"
            >
              {isGenerating ? (
                "Génération..."
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};