/** Perkecil foto di browser (sisi terpanjang maks `maksPx`, JPEG) supaya cepat diunggah dan di bawah batas ukuran. */
export async function perkecilFoto(file: File, maksPx = 1600, nama = "foto.jpg"): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const skala = Math.min(1, maksPx / Math.max(bmp.width, bmp.height));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(bmp.width * skala);
  kanvas.height = Math.round(bmp.height * skala);
  kanvas.getContext("2d")!.drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Gagal memperkecil foto");
  return new File([blob], nama, { type: "image/jpeg" });
}
