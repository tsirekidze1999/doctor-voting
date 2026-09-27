import sharp from "sharp";
import { AdminError } from "./admin-auth";

export async function normalizePhoto(value: unknown, dimension = 480, maxBytes = 80000): Promise<string> {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes * 4 / 3) + 100) throw new AdminError(400, "ფოტო მეტისმეტად დიდია");
  const photo = value.trim();
  if (!photo.startsWith("data:")) {
    try { if (photo.length > 1500 || new URL(photo).protocol !== "https:") throw new Error(); }
    catch { throw new AdminError(400, "ფოტოსთვის საჭიროა https ბმული"); }
    return photo;
  }
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) throw new AdminError(400, "ფოტოს ფორმატი არასწორია");
  try {
    const bytes = Buffer.from(photo.split(",")[1], "base64");
    if (bytes.length > maxBytes) throw new Error();
    const encoded = await sharp(bytes, { limitInputPixels: dimension * dimension + 1 }).rotate().resize(dimension, dimension, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    if (encoded.length > maxBytes) throw new Error();
    return "data:image/jpeg;base64," + encoded.toString("base64");
  } catch { throw new AdminError(400, "ფოტო ვერ დამუშავდა. აირჩიე სხვა სურათი."); }
}
