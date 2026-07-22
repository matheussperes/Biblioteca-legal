import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "mammoth",
    "@prisma/client",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  // O pdfjs-dist carrega o worker e os recursos de fonte/cmap por caminho em
  // runtime — o rastreador de arquivos da Vercel não consegue detectá-los, então
  // não os inclui no deploy (erro "Cannot find module .../pdf.worker.mjs"). Aqui
  // forçamos a inclusão desses arquivos no bundle da rota que roda a extração.
  outputFileTracingIncludes: {
    "/api/documents/[id]/steps/[step]": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
