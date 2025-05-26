export function isBase64ImageDataUrl(img: string) {
  try {
    return img.startsWith('data:image/') && img.includes('base64');
  } catch (error) {
    return false;
  }
}
