declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfResult = { text: string };
  type PdfParser = (dataBuffer: Buffer) => Promise<PdfResult>;
  const pdf: PdfParser;
  export default pdf;
}
