const fs = require('fs');
const pdfParse = require('pdf-parse');

async function readPDF() {
    const dataBuffer = fs.readFileSync('uploads/CoatzadroneUSA_NDA.pdf');
    try {
        const data = await pdfParse(dataBuffer);
        console.log("--- TEXT START ---");
        console.log(data.text);
        console.log("--- TEXT END ---");
    } catch (err) {
        console.error("Error reading PDF:", err);
    }
}
readPDF();
