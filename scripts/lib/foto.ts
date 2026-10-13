/** Elaborazione di una foto: orientamento EXIF, ritaglio 4:5 sul soggetto, massimo 640×800, WebP senza metadati. */
import sharp from 'sharp';

export async function elabora(origine: string, destinazione: string): Promise<void> {
  // sharp di default non copia i metadati: niente withMetadata() né keepMetadata()
  await sharp(origine)
    .rotate()
    .resize({ width: 640, height: 800, fit: 'cover', position: sharp.strategy.attention, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destinazione);
}
