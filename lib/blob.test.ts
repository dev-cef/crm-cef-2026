import { describe, it, expect } from "vitest";
import { parseImageDataUrl, shouldUploadToBlob } from "@/lib/blob";

// 1x1 PNG transparente
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("shouldUploadToBlob", () => {
  it("true só para data URI de imagem", () => {
    expect(shouldUploadToBlob(PNG_1x1)).toBe(true);
    expect(shouldUploadToBlob("data:image/jpeg;base64,abc")).toBe(true);
  });

  it("false para URLs http(s), vazios e não-imagem", () => {
    expect(shouldUploadToBlob("https://covers.openlibrary.org/x.jpg")).toBe(false);
    expect(shouldUploadToBlob("https://algo.public.blob.vercel-storage.com/a.png")).toBe(false);
    expect(shouldUploadToBlob("")).toBe(false);
    expect(shouldUploadToBlob(null)).toBe(false);
    expect(shouldUploadToBlob(undefined)).toBe(false);
    expect(shouldUploadToBlob("data:application/pdf;base64,abc")).toBe(false);
  });
});

describe("parseImageDataUrl", () => {
  it("extrai contentType, extensão e buffer de um PNG válido", () => {
    const p = parseImageDataUrl(PNG_1x1);
    expect(p).not.toBeNull();
    expect(p!.contentType).toBe("image/png");
    expect(p!.ext).toBe("png");
    expect(p!.buffer.length).toBeGreaterThan(0);
  });

  it("mapeia jpeg/jpg para extensão jpg", () => {
    expect(parseImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")?.ext).toBe("jpg");
  });

  it("rejeita não-imagem, MIME desconhecido e não-data-URI", () => {
    expect(parseImageDataUrl("https://x/y.png")).toBeNull();
    expect(parseImageDataUrl("data:application/pdf;base64,abc")).toBeNull();
    expect(parseImageDataUrl("data:image/tiff;base64,abc")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64,")).toBeNull();
  });
});
