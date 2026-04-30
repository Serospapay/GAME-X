import { fail, ok } from "@/lib/api-response";
import { fetchTariffs } from "@/lib/tariffs";

export async function GET() {
  try {
    const tariffs = await fetchTariffs();
    return ok(tariffs);
  } catch {
    return fail("Не вдалося завантажити тарифи", 500, "TARIFFS_FETCH_FAILED");
  }
}
