import jsPDF from 'jspdf';

/**
 * Generate a professionally formatted PDF from agreement text content
 * with AYP letterhead, proper section formatting, signature lines, and page numbers.
 */

interface PdfOptions {
  documentName: string;
  investorName?: string;
  content: string;
  documentType?: string;
}

export function generateAgreementPdf(options: PdfOptions) {
  const { documentName, investorName, content, documentType } = options;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const marginTop = 35;
  const marginBottom = 30;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = marginTop;
  let pageNumber = 1;

  // Colors
  const navyBlue: [number, number, number] = [26, 54, 93]; // #1a365d
  const gold: [number, number, number] = [212, 165, 116]; // #d4a574
  const darkGray: [number, number, number] = [51, 51, 51];
  const mediumGray: [number, number, number] = [128, 128, 128];

  // ---- HELPER FUNCTIONS ----

  function addHeader() {
    // Navy blue header bar
    doc.setFillColor(...navyBlue);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Gold accent line
    doc.setFillColor(...gold);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('SET UP YOUR PLACE LLC', marginLeft, 12);

    // DBA line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('DBA: Access Your Place / AYP / Your Place  |  A Subsidiary of Cooper Family Inc.', marginLeft, 18);

    // Address
    doc.setFontSize(7);
    doc.text('1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126', marginLeft, 23);

    // Reset text color
    doc.setTextColor(...darkGray);
  }

  function addFooter() {
    // Footer line
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, pageHeight - 18, pageWidth - marginRight, pageHeight - 18);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...mediumGray);
    doc.text('Set Up Your Place LLC  |  Confidential  |  www.accessyourplace.com', marginLeft, pageHeight - 13);
    
    // Page number
    doc.text(`Page ${pageNumber}`, pageWidth - marginRight, pageHeight - 13, { align: 'right' });

    doc.setTextColor(...darkGray);
  }

  function addNewPage() {
    addFooter();
    doc.addPage();
    pageNumber++;
    addHeader();
    currentY = marginTop;
  }

  function checkPageBreak(neededSpace: number) {
    if (currentY + neededSpace > pageHeight - marginBottom) {
      addNewPage();
    }
  }

  function addText(text: string, fontSize: number, fontStyle: string = 'normal', color: [number, number, number] = darkGray, lineHeight: number = 1.4) {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    const lines = doc.splitTextToSize(text, contentWidth);
    const lineSpacing = fontSize * 0.3528 * lineHeight; // mm per line

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineSpacing + 2);
      doc.text(lines[i], marginLeft, currentY);
      currentY += lineSpacing;
    }
  }

  function addCenteredText(text: string, fontSize: number, fontStyle: string = 'normal', color: [number, number, number] = darkGray) {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineSpacing = fontSize * 0.3528 * 1.4;

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineSpacing + 2);
      doc.text(lines[i], pageWidth / 2, currentY, { align: 'center' });
      currentY += lineSpacing;
    }
  }

  function addSignatureLine(label: string) {
    checkPageBreak(15);
    currentY += 3;
    doc.setDrawColor(...darkGray);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, currentY, marginLeft + 80, currentY);
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text(label, marginLeft, currentY);
    currentY += 5;
  }

  // ---- BUILD THE PDF ----

  // Add first page header
  addHeader();
  currentY = marginTop + 5;

  // Parse the content into lines
  const rawLines = content.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd();
    const trimmedLine = line.trim();

    // Skip empty lines (add small spacing)
    if (!trimmedLine) {
      currentY += 3;
      continue;
    }

    // Detect document title (first non-empty line that's all caps or contains "AGREEMENT")
    if (i < 5 && (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 10 && /[A-Z]{3,}/.test(trimmedLine))) {
      checkPageBreak(12);
      addCenteredText(trimmedLine, 13, 'bold', navyBlue);
      currentY += 2;
      continue;
    }

    // Detect "Set Up Your Place" subtitle lines near the top
    if (i < 8 && (trimmedLine.startsWith('Set Up Your Place') || trimmedLine.startsWith('A Subsidiary'))) {
      addCenteredText(trimmedLine, 9, 'normal', mediumGray);
      currentY += 1;
      continue;
    }

    // Detect section headers (numbered: "1.", "2.", etc.)
    const sectionMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (sectionMatch && trimmedLine === trimmedLine.toUpperCase()) {
      checkPageBreak(15);
      currentY += 5;
      // Gold accent bar
      doc.setFillColor(...gold);
      doc.rect(marginLeft, currentY - 3, 3, 6, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...navyBlue);
      doc.text(trimmedLine, marginLeft + 5, currentY + 1);
      currentY += 8;
      continue;
    }

    // Detect sub-section headers (e.g., "1.1", "2.1", "3.2")
    const subSectionMatch = trimmedLine.match(/^(\d+\.\d+)\s+(.+)/);
    if (subSectionMatch) {
      checkPageBreak(10);
      currentY += 3;
      addText(trimmedLine, 10, 'bold', navyBlue);
      currentY += 2;
      continue;
    }

    // Detect "THIS AGREEMENT" or "IN WITNESS WHEREOF" lines
    if (trimmedLine.startsWith('THIS AGREEMENT') || trimmedLine.startsWith('THIS SUBLEASE') || trimmedLine.startsWith('IN WITNESS WHEREOF')) {
      checkPageBreak(10);
      currentY += 3;
      addText(trimmedLine, 9, 'bolditalic', navyBlue);
      currentY += 2;
      continue;
    }

    // Detect party headers (THE COMPANY, THE CLIENT, SUBLESSOR, SUBLESSEE)
    if (/^(THE COMPANY|THE CLIENT|SUBLESSOR|SUBLESSEE|AND):?$/.test(trimmedLine)) {
      checkPageBreak(10);
      currentY += 4;
      addText(trimmedLine, 10, 'bold', navyBlue);
      currentY += 1;
      continue;
    }

    // Detect signature lines
    if (trimmedLine.startsWith('Signature:') && trimmedLine.includes('____')) {
      addSignatureLine('Signature');
      continue;
    }
    if (trimmedLine.startsWith('Print Name:') && trimmedLine.includes('____')) {
      addSignatureLine('Print Name');
      continue;
    }
    if (trimmedLine.startsWith('Date:') && trimmedLine.includes('____')) {
      addSignatureLine('Date');
      continue;
    }
    if (trimmedLine.startsWith('Title:') && trimmedLine.includes('____')) {
      addSignatureLine('Title');
      continue;
    }

    // Detect specific name/value lines (Print Name: John Doe, etc.)
    if (trimmedLine.startsWith('Print Name:') || trimmedLine.startsWith('Title:')) {
      const parts = trimmedLine.split(':');
      if (parts.length >= 2 && parts[1].trim()) {
        checkPageBreak(8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...mediumGray);
        doc.text(parts[0] + ':', marginLeft, currentY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkGray);
        doc.text(parts[1].trim(), marginLeft + 25, currentY);
        currentY += 5;
        continue;
      }
    }

    // Detect bullet points
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      checkPageBreak(8);
      const bulletText = trimmedLine.substring(2);
      
      // Gold bullet
      doc.setFillColor(...gold);
      doc.circle(marginLeft + 2, currentY - 1, 1, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...darkGray);
      
      const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 8);
      for (let j = 0; j < bulletLines.length; j++) {
        checkPageBreak(5);
        doc.text(bulletLines[j], marginLeft + 6, currentY);
        currentY += 4;
      }
      currentY += 1;
      continue;
    }

    // Detect checkbox items
    if (trimmedLine.startsWith('[X]') || trimmedLine.startsWith('[ ]')) {
      checkPageBreak(8);
      const isChecked = trimmedLine.startsWith('[X]');
      const checkText = trimmedLine.substring(4);
      
      // Draw checkbox
      doc.setDrawColor(...navyBlue);
      doc.setLineWidth(0.3);
      doc.rect(marginLeft + 2, currentY - 3.5, 3.5, 3.5);
      
      if (isChecked) {
        doc.setFillColor(...gold);
        doc.rect(marginLeft + 2.5, currentY - 3, 2.5, 2.5, 'F');
      }
      
      doc.setFont('helvetica', isChecked ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...darkGray);
      
      const checkLines = doc.splitTextToSize(checkText, contentWidth - 12);
      for (let j = 0; j < checkLines.length; j++) {
        checkPageBreak(5);
        doc.text(checkLines[j], marginLeft + 8, currentY);
        currentY += 4;
      }
      currentY += 1;
      continue;
    }

    // Detect key-value lines like "Name/Entity:", "Email:", "Address:"
    const kvMatch = trimmedLine.match(/^(Name\/Entity|Email|Address|Configuration|Included Assets|Community\/Building Name|Total Acquisition Fee|Fee Disclosure|Total Setup Fee|Monthly Rent|Prorated|Security Deposit|Estimated Completion|Possession|Expiration|Agreement Effective):\s*(.+)/i);
    if (kvMatch) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...mediumGray);
      doc.text(kvMatch[1] + ':', marginLeft + 4, currentY);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      const valueLines = doc.splitTextToSize(kvMatch[2], contentWidth - 45);
      doc.text(valueLines[0], marginLeft + 45, currentY);
      currentY += 5;
      for (let j = 1; j < valueLines.length; j++) {
        doc.text(valueLines[j], marginLeft + 45, currentY);
        currentY += 4;
      }
      continue;
    }

    // Detect "(Hereinafter referred to as..." lines
    if (trimmedLine.startsWith('(Hereinafter')) {
      addText(trimmedLine, 8, 'italic', mediumGray);
      currentY += 1;
      continue;
    }

    // Default: regular paragraph text
    addText(trimmedLine, 9, 'normal', darkGray);
    currentY += 1;
  }

  // Add footer to last page
  addFooter();

  // Generate filename
  const sanitizedName = documentName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
  const investorPart = investorName ? `_${investorName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const datePart = new Date().toISOString().split('T')[0];
  const filename = `AYP_${sanitizedName}${investorPart}_${datePart}.pdf`;

  // Save the PDF
  doc.save(filename);

  return { success: true, filename };
}
