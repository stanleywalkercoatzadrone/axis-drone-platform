import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

async function createNDA() {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]);
    const form = pdfDoc.getForm();
    let currentY = 720;

    // Header
    page.drawText('CoatzaDrone', { x: 210, y: currentY, size: 20, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawText('USA', { x: 337, y: currentY, size: 20, font: helveticaBold, color: rgb(0.9, 0.1, 0.1) });
    page.drawText(' LLC', { x: 378, y: currentY, size: 20, font: helveticaBold, color: rgb(0, 0, 0) });
    currentY -= 30;

    page.drawText('SUBCONTRACTOR & PILOT CONFIDENTIALITY / NDA', { x: 115, y: currentY, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
    currentY -= 30;

    const introText = "This Non-Disclosure and Confidentiality Agreement (“Agreement”) is entered into as of the Effective Date below between:\n\nCompany: CoatzadroneUSA (“Company”)";
    page.drawText(introText, { x: 50, y: currentY, size: 10, font: helvetica, maxWidth: 512, lineHeight: 14 });
    currentY -= 50;

    page.drawText("Subcontractor/Pilot: ", { x: 50, y: currentY + 8, size: 10, font: helveticaBold });
    const contractorField = form.createTextField('contractorName');
    contractorField.addToPage(page, { x: 170, y: currentY, width: 250, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });
    page.drawText(" (“Contractor”)", { x: 425, y: currentY + 8, size: 10, font: helvetica });
    currentY -= 40;

    const sections = [
        { title: "1. PURPOSE", text: "Contractor will perform drone services on behalf of CoatzadroneUSA, including but not limited to aerial photography, mapping, thermal imaging, videography, inspections, and all related field operations (“Services”). Contractor may access confidential, sensitive, proprietary, or client-restricted information. This Agreement protects that information and defines the contractor’s obligations." },
        { title: "2. CONFIDENTIAL INFORMATION", text: "“Confidential Information” includes client names, contacts, job sites, pricing, bids, proposals; flight plans, deliverables, maps, thermal datasets, raw/processed media; workflows, templates, formats, methods; and all non-public information obtained while performing Services." },
        { title: "3. CONTRACTOR OBLIGATIONS", text: "Contractor agrees to maintain confidentiality; not disclose or use information for personal gain; not contact clients; not post/share deliverables; return/delete all data upon request; follow CoatzadroneUSA standards; maintain FAA Part 107 compliance." },
        { title: "4. OWNERSHIP OF WORK PRODUCT", text: "All media/data/deliverables created under CoatzadroneUSA are exclusive Company property and may not be retained or used by Contractor." },
        { title: "5. LIMITED NON-COMPETE", text: "For 12 months after the final assignment, Contractor shall not solicit or perform drone work for CoatzadroneUSA clients outside Company authorization." },
        { title: "6. NON-CIRCUMVENTION", text: "Contractor shall not bypass the Company, negotiate directly with clients, or replicate Company workflows for self-gain." },
        { title: "7. SAFETY & COMPLIANCE", text: "Contractor must maintain FAA Part 107 certification, registration, Remote ID compliance, and follow all safety and site rules." },
        { title: "8. INDEPENDENT CONTRACTOR STATUS", text: "Contractor is not an employee and is responsible for all taxes, equipment, insurance, and certifications." },
        { title: "9. TERM & TERMINATION", text: "Agreement begins on the Effective Date, continues until terminated, and confidentiality clauses survive indefinitely." },
        { title: "10. REMEDIES", text: "CoatzadroneUSA may seek injunctive relief, damages, and legal fees for any breach." },
        { title: "11. GOVERNING LAW", text: "This Agreement is governed by the laws of the state where CoatzadroneUSA is headquartered." }
    ];

    for (const sec of sections) {
        const charsPerLine = 90;
        const lines = Math.ceil(sec.text.length / charsPerLine);
        const secHeight = 15 + (lines * 14) + 15;

        if (currentY - secHeight < 50) {
            page = pdfDoc.addPage([612, 792]);
            currentY = 740;
        }

        page.drawText(sec.title, { x: 50, y: currentY, size: 10, font: helveticaBold });
        currentY -= 14;
        page.drawText(sec.text, { x: 50, y: currentY, size: 10, font: helvetica, maxWidth: 512, lineHeight: 14 });
        currentY -= (lines * 14) + 10;
    }

    currentY -= 20;
    if (currentY < 180) {
        page = pdfDoc.addPage([612, 792]);
        currentY = 740;
    }

    page.drawText('12. SIGNATURES', { x: 50, y: currentY, size: 12, font: helveticaBold });
    currentY -= 30;

    page.drawText('CoatzadroneUSA', { x: 50, y: currentY, size: 10, font: helveticaBold });
    currentY -= 30;
    page.drawText('Name:', { x: 50, y: currentY + 5, size: 10, font: helvetica });
    const cNameField = form.createTextField('companyName');
    cNameField.addToPage(page, { x: 110, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });
    currentY -= 30;
    page.drawText('Title:', { x: 50, y: currentY + 5, size: 10, font: helvetica });
    const cTitleField = form.createTextField('companyTitle');
    cTitleField.addToPage(page, { x: 110, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });
    currentY -= 30;
    page.drawText('Signature:', { x: 50, y: currentY + 5, size: 10, font: helvetica });
    const cSigField = form.createTextField('companySignature');
    cSigField.addToPage(page, { x: 110, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });
    currentY -= 30;
    page.drawText('Date:', { x: 50, y: currentY + 5, size: 10, font: helvetica });
    const cDateField = form.createTextField('companyDate');
    cDateField.addToPage(page, { x: 110, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });

    currentY += 120;
    page.drawText('Contractor/Pilot', { x: 320, y: currentY, size: 10, font: helveticaBold });
    currentY -= 30;
    page.drawText('Name:', { x: 320, y: currentY + 5, size: 10, font: helvetica });
    const pNameField = form.createTextField('pilotName');
    pNameField.addToPage(page, { x: 380, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });
    currentY -= 30;
    currentY -= 30;
    page.drawText('Signature:', { x: 320, y: currentY + 5, size: 10, font: helvetica });
    const pSigField = form.createTextField('pilotSignature');
    pSigField.addToPage(page, { x: 380, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });
    currentY -= 30;
    page.drawText('Date:', { x: 320, y: currentY + 5, size: 10, font: helvetica });
    const pDateField = form.createTextField('pilotDate');
    pDateField.addToPage(page, { x: 380, y: currentY, width: 180, height: 20, backgroundColor: rgb(0.92, 0.94, 1), borderColor: rgb(0.8, 0.8, 0.8) });

    currentY -= 60;
    const footerLines = [
        "COATZADRONEUSA — Aerial Imaging   Mapping   Inspection",
        "confidential@coatzadroneusa.com | www.coatzadroneusa.com",
        "All data and deliverables are proprietary and protected. Unauthorized use is strictly prohibited."
    ];
    for (const f of footerLines) {
        page.drawText(f, { x: 120, y: currentY, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
        currentY -= 12;
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('uploads/CoatzadroneUSA_NDA.pdf', pdfBytes);
    console.log('Successfully created CoatzadroneUSA_NDA.pdf');
}

createNDA().catch(console.error);
