import { supabase } from "./supabase";

/** Downscale to at most `maxDim` px and re-encode as JPEG (82%). Falls back to the original file. */
export async function compressImage(file: File, maxDim = 1280): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height); height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", 0.82);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

/** Resize, upload to the avatars bucket under the user's folder, and return the public URL. */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const compressed = await compressImage(file, 512);
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, compressed, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
