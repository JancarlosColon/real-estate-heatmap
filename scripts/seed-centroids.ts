import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("Fetching ZIP centroids...");
  const res = await fetch("https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%20Zip%20Codes%20from%202013%20Government%20Data");
  const text = await res.text();
  const lines = text.trim().split("\n");
  const centroids: {zip_code: string; lat: number; lng: number}[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 3) {
      centroids.push({ zip_code: parts[0].trim(), lat: parseFloat(parts[1]), lng: parseFloat(parts[2]) });
    }
  }
  console.log(`Upserting ${centroids.length} centroids...`);
  for (let i = 0; i < centroids.length; i += 200) {
    const batch = centroids.slice(i, i + 200);
    const { error } = await supabase.from("zip_centroids").upsert(batch, { onConflict: "zip_code" });
    if (error) { console.error("Error:", error.message); process.exit(1); }
    if (i % 4000 === 0) process.stdout.write(`  ${i}/${centroids.length}\r`);
  }
  console.log(`\nDone! ${centroids.length} centroids seeded`);
}
main();
