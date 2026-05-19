import sys
try:
    from pypdf import PdfReader
    reader = PdfReader('uploads/CoatzadroneUSA_NDA.pdf')
    print("--- TEXT START ---")
    for page in reader.pages:
        print(page.extract_text())
    print("--- TEXT END ---")
except Exception as e:
    print("Error:", e)
