// Pembuat CSV buat Google Sheets / Excel. Murni fungsi, gampang dites.

/** Escape satu sel: kutip kalau mengandung koma, kutip, atau baris baru. Sel yang diawali = + - @ diberi apostrof (cegah rumus tak sengaja). */
export function sel(nilai: unknown): string {
  if (nilai == null) return "";
  let s = typeof nilai === "number" ? String(nilai) : String(nilai);
  if (typeof nilai === "string" && /^[=+@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV dengan BOM UTF-8 supaya huruf dan emoji tampil benar di Sheets/Excel. */
export function buatCsv(kolom: string[], baris: unknown[][]): string {
  const garis = [kolom.map(sel).join(","), ...baris.map((b) => b.map(sel).join(","))];
  return `﻿${garis.join("\r\n")}\r\n`;
}
