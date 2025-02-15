export function isBase64ImageDataUrl(img: string) {
  return img.startsWith('data:image/') && img.includes('base64');
}
