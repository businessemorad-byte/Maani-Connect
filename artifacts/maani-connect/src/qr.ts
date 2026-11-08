export function encodeBadgeQr(value: string): boolean[][] {
  const size = 33;
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 78) throw new Error('Badge number is too long for QR encoding.');
  const bitData = [0, 1, 0, 0];
  const appendBits = (n: number, length: number) => { for (let i = length - 1; i >= 0; i--) bitData.push((n >>> i) & 1); };
  appendBits(bytes.length, 8);
  bytes.forEach(byte => appendBits(byte, 8));
  for (let i = 0; i < Math.min(4, 640 - bitData.length); i++) bitData.push(0);
  while (bitData.length % 8 !== 0) bitData.push(0);
  const data: number[] = [];
  for (let i = 0; i < bitData.length; i += 8) data.push(bitData.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  const initialDataLength = data.length;
  while (data.length < 80) data.push((data.length - initialDataLength) % 2 === 0 ? 0xec : 0x11);
  const multiply = (x: number, y: number) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  };
  let divisor = [1];
  let root = 1;
  for (let i = 0; i < 20; i++) {
    const next = Array(divisor.length + 1).fill(0) as number[];
    divisor.forEach((coefficient, j) => {
      next[j] ^= coefficient;
      next[j + 1] ^= multiply(coefficient, root);
    });
    divisor = next;
    root = multiply(root, 2);
  }
  const remainder = Array(20).fill(0) as number[];
  data.forEach(byte => {
    const factor = byte ^ remainder.shift()!;
    remainder.push(0);
    remainder.forEach((_, i) => { remainder[i] ^= multiply(divisor[i + 1], factor); });
  });
  const codewords = [...data, ...remainder];
  const grid: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) grid[y][x] = dark; };
  const finder = (cx: number, cy: number) => {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      set(cx + dx, cy + dy, inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)));
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(26 + dx, 26 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const formatCoords: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  formatCoords.forEach(([x, y]) => set(x, y, false));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, false);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, false);
  set(8, size - 8, true);
  const bits = codewords.flatMap(word => Array.from({ length: 8 }, (_, i) => (word >>> (7 - i)) & 1));
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (grid[y][x] !== null) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex++] === 1 : false;
        set(x, y, bit !== ((x + y) % 2 === 0));
      }
    }
  }
  let format = 1 << 3;
  let rem = format;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  format = ((format << 10) | rem) ^ 0x5412;
  const setFormatBit = (x: number, y: number, i: number) => set(x, y, ((format >>> i) & 1) !== 0);
  formatCoords.forEach(([x, y], i) => setFormatBit(x, y, i));
  for (let i = 0; i < 8; i++) setFormatBit(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) setFormatBit(8, size - 15 + i, i);
  set(8, size - 8, true);
  return grid.map(row => row.map(Boolean));
}
