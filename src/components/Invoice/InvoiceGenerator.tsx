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
    sale_items: Array<{
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  };
}

export const InvoiceGenerator = ({ saleData }: InvoiceGeneratorProps) => {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    customer_name: saleData?.customer_name || '',
    customer_email: '',
    customer_address: '',
    items: saleData?.sale_items?.map(item => ({
      name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.subtotal
    })) || [],
    total_amount: saleData?.total_amount || 0,
    payment_method: saleData?.payment_method || 'cash',
    date: saleData?.created_at ? new Date(saleData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    invoice_number: `INV-${Date.now()}`
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    try {
      setIsGenerating(true);

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 20;

      // Company Header
      pdf.setFontSize(24);
      pdf.setTextColor(34, 85, 170); // Primary color
      pdf.text('GF DISTRIBUTION', margin, 30);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Système de gestion des ventes', margin, 40);
      pdf.text('123 Rue de Commerce, 75001 Paris', margin, 50);
      pdf.text('Tél: 01 23 45 67 89 | Email: contact@gfdistribution.fr', margin, 60);

      // Invoice Title
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('FACTURE', pageWidth - margin - 50, 30);
      
      pdf.setFontSize(12);
      pdf.text(`N° ${invoiceData.invoice_number}`, pageWidth - margin - 50, 45);
      pdf.text(`Date: ${invoiceData.date}`, pageWidth - margin - 50, 55);

      // Customer Information
      pdf.setFontSize(14);
      pdf.text('Facturé à:', margin, 80);
      
      pdf.setFontSize(12);
      pdf.text(invoiceData.customer_name || 'Client', margin, 95);
      if (invoiceData.customer_email) {
        pdf.text(invoiceData.customer_email, margin, 105);
      }
      if (invoiceData.customer_address) {
        pdf.text(invoiceData.customer_address, margin, 115);
      }

      // Table Header
      const tableTop = 140;
      const tableLeft = margin;
      const colWidths = [80, 30, 30, 40];
      const colPositions = [
        tableLeft,
        tableLeft + colWidths[0],
        tableLeft + colWidths[0] + colWidths[1],
        tableLeft + colWidths[0] + colWidths[1] + colWidths[2]
      ];

      // Draw table header
      pdf.setFillColor(34, 85, 170);
      pdf.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), 10, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.text('Description', colPositions[0] + 2, tableTop + 7);
      pdf.text('Qté', colPositions[1] + 2, tableTop + 7);
      pdf.text('Prix U.', colPositions[2] + 2, tableTop + 7);
      pdf.text('Total', colPositions[3] + 2, tableTop + 7);

      // Table Content
      pdf.setTextColor(0, 0, 0);
      let currentY = tableTop + 10;

      invoiceData.items.forEach((item, index) => {
        const rowHeight = 8;
        currentY += rowHeight;

        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(tableLeft, currentY - 6, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        }

        pdf.text(item.name, colPositions[0] + 2, currentY);
        pdf.text(item.quantity.toString(), colPositions[1] + 2, currentY);
        pdf.text(`${item.unit_price.toFixed(2)} €`, colPositions[2] + 2, currentY);
        pdf.text(`${item.total.toFixed(2)} €`, colPositions[3] + 2, currentY);
      });

      // Total Section
      currentY += 20;
      const totalBoxLeft = pageWidth - margin - 60;
      
      pdf.setFillColor(34, 85, 170);
      pdf.rect(totalBoxLeft, currentY, 60, 15, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text('TOTAL', totalBoxLeft + 5, currentY + 10);
      pdf.text(`${invoiceData.total_amount.toFixed(2)} €`, totalBoxLeft + 35, currentY + 10);

      // Payment Information
      currentY += 30;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.text(`Mode de paiement: ${invoiceData.payment_method.toUpperCase()}`, margin, currentY);

      // Footer
      const footerY = pdf.internal.pageSize.height - 30;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Merci pour votre confiance !', margin, footerY);
      pdf.text('GF Distribution - Tous droits réservés', pageWidth - margin - 70, footerY);

      // Save the PDF
      const fileName = `facture_${invoiceData.invoice_number}_${invoiceData.customer_name.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Succès",
        description: "Facture PDF générée avec succès"
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la facture PDF",
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
        <title>Aperçu Facture - ${invoiceData.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2255aa; padding-bottom: 20px; }
          .company-name { color: #2255aa; font-size: 28px; font-weight: bold; margin: 0; }
          .company-info { color: #666; font-size: 12px; margin-top: 10px; }
          .invoice-info { text-align: right; margin-bottom: 30px; }
          .customer-info { margin-bottom: 30px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .table th { background-color: #2255aa; color: white; padding: 10px; text-align: left; }
          .table td { padding: 8px; border-bottom: 1px solid #ddd; }
          .table tr:nth-child(even) { background-color: #f9f9f9; }
          .total-section { text-align: right; margin-top: 20px; }
          .total-box { background-color: #2255aa; color: white; padding: 15px; display: inline-block; margin-left: auto; }
          .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="company-name">GF DISTRIBUTION</h1>
          <div class="company-info">
            Système de gestion des ventes<br>
            123 Rue de Commerce, 75001 Paris<br>
            Tél: 01 23 45 67 89 | Email: contact@gfdistribution.fr
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
                <td>${item.unit_price.toFixed(2)} €</td>
                <td>${item.total.toFixed(2)} €</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <strong>TOTAL: ${invoiceData.total_amount.toFixed(2)} €</strong>
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
                <div className="font-semibold text-success">{invoiceData.total_amount.toFixed(2)} €</div>
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
                      <td className="text-right p-2">{item.unit_price.toFixed(2)} €</td>
                      <td className="text-right p-2">{item.total.toFixed(2)} €</td>
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