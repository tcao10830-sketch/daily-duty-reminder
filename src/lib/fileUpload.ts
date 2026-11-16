export async function fileUploadPayload(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Each file must be 10 MB or smaller.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) reject(new Error('Could not read this file.'));
      else resolve(value.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, mimeType: file.type, base64 };
}
