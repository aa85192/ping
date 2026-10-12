/** Extract dominant colours from a photo (e.g. your own 星星人 figure) with a small k-means. */
export async function extractPalette(file: File, k = 8): Promise<string[]> {
  const bmp = await createImageBitmap(file);
  const size = 96;
  const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const px: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Skip near-white / near-black / grey backgrounds; we want the figure's colours.
    if (max - min < 28 || max < 40 || min > 235) continue;
    px.push([r, g, b]);
  }
  if (px.length < k) return [];
  let centers = Array.from({ length: k }, (_, i) => px[Math.floor((i / k) * px.length)]);
  let counts = new Array(k).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const p of px) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      counts[best]++;
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
    }
    centers = centers.map((c, j) => (counts[j] ? (sums[j].map((s) => s / counts[j]) as [number, number, number]) : c));
  }
  const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  return centers
    .map((c, j) => ({ c, n: counts[j] }))
    .filter((x) => x.n > px.length * 0.01)
    .sort((a, b) => b.n - a.n)
    .map((x) => hex(x.c))
    .filter((v, i, arr) => arr.indexOf(v) === i);
}
