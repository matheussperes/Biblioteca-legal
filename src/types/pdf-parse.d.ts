declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Options, Result } from "pdf-parse";
  export default function pdfParse(
    dataBuffer: Buffer,
    options?: Options
  ): Promise<Result>;
}
