import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

async function createForm() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const form = pdfDoc.getForm();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Title
    page.drawText('CoatzaDrone', { x: 210, y: 720, size: 20, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawText('USA', { x: 337, y: 720, size: 20, font: helveticaBold, color: rgb(0.9, 0.1, 0.1) });
    page.drawText(' LLC', { x: 378, y: 720, size: 20, font: helveticaBold, color: rgb(0, 0, 0) });

    page.drawText('DIRECT DEPOSIT AUTHORIZATION FORM', { x: 135, y: 680, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });

    // Section 1: Pilot Information
    page.drawText('Section 1: Pilot Information', { x: 50, y: 640, size: 12, font: helveticaBold });

    const drawField = (label, name, x, y, inputX, width, height = 24) => {
        page.drawText(label, { x: x, y: y + 8, size: 10, font: helvetica });
        const field = form.createTextField(name);
        field.addToPage(page, {
            x: inputX, y, width, height,
            backgroundColor: rgb(0.92, 0.94, 1),
            borderColor: rgb(0.8, 0.8, 0.8)
        });
    };

    let currentY = 600;
    const labelX = 70;
    const inputX = 180;
    const fullW = 360;

    drawField('Full Name:', 'fullName', labelX, currentY, inputX, fullW);
    currentY -= 30;
    drawField('Address:', 'address', labelX, currentY, inputX, fullW);
    currentY -= 30;

    // Split City State Zip
    page.drawText('City:', { x: labelX, y: currentY + 8, size: 10, font: helvetica });
    const cityField = form.createTextField('city');
    cityField.addToPage(page, { x: inputX, y: currentY, width: 150, height: 24, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });

    page.drawText('State:', { x: 340, y: currentY + 8, size: 10, font: helvetica });
    const stateField = form.createTextField('state');
    stateField.addToPage(page, { x: 375, y: currentY, width: 40, height: 24, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });

    page.drawText('Zip Code:', { x: 425, y: currentY + 8, size: 10, font: helvetica });
    const zipField = form.createTextField('zip');
    zipField.addToPage(page, { x: 480, y: currentY, width: 60, height: 24, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });

    currentY -= 30;
    drawField('Phone Number:', 'phone', labelX, currentY, inputX, fullW);
    currentY -= 30;
    drawField('Email Address:', 'email', labelX, currentY, inputX, fullW);

    currentY -= 60;
    // Section 2: Bank Information
    page.drawText('Section 2: Bank Information', { x: 50, y: currentY + 30, size: 12, font: helveticaBold });

    drawField('Bank Name:', 'bankName', labelX, currentY, inputX, fullW);
    currentY -= 30;
    drawField('Routing Number:', 'routingNumber', labelX, currentY, inputX, fullW);
    currentY -= 30;
    drawField('Account Number:', 'accountNumber', labelX, currentY, inputX, fullW);
    currentY -= 30;

    // Checkboxes for Account Type
    page.drawText('Account Type:', { x: labelX, y: currentY + 8, size: 10, font: helvetica });
    const checkingBox = form.createCheckBox('checking');
    checkingBox.addToPage(page, { x: inputX, y: currentY + 4, width: 14, height: 14 });
    page.drawText('Checking', { x: inputX + 20, y: currentY + 8, size: 10, font: helvetica });

    const savingsBox = form.createCheckBox('savings');
    savingsBox.addToPage(page, { x: inputX + 100, y: currentY + 4, width: 14, height: 14 });
    page.drawText('Savings', { x: inputX + 120, y: currentY + 8, size: 10, font: helvetica });

    currentY -= 60;
    // Section 3: Authorization
    page.drawText('Section 3: Authorization', { x: 50, y: currentY + 35, size: 12, font: helveticaBold });

    const authText = "I hereby authorize CoatzaDroneUSA LLC to initiate direct deposit entries to the account indicated above. This authorization will remain in effect until I provide written notice of cancellation.";
    page.drawText(authText, { x: 50, y: currentY + 10, size: 10, font: helvetica, maxWidth: 500, lineHeight: 15 });

    currentY -= 40;
    page.drawText('Signature:', { x: 100, y: currentY + 8, size: 10, font: helvetica });
    const sigField = form.createTextField('signature');
    sigField.addToPage(page, { x: 160, y: currentY, width: 200, height: 30, backgroundColor: rgb(0.92, 0.94, 1) });

    page.drawText('Date:', { x: 380, y: currentY + 8, size: 10, font: helvetica });
    const dateField = form.createTextField('date');
    dateField.addToPage(page, { x: 415, y: currentY, width: 100, height: 30, backgroundColor: rgb(0.92, 0.94, 1) });

    // Footer
    page.drawText('© CoatzaDroneUSA LLC — All Rights Reserved', { x: 190, y: 70, size: 9, font: helvetica, color: rgb(0.6, 0.6, 0.6) });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('uploads/direct_deposit.pdf', pdfBytes);
    console.log('Successfully created uploads/direct_deposit.pdf');
}

createForm().catch(console.error);
