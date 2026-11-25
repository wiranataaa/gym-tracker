// Kutipan pemecut harian (gaya kasar, permintaan Nata sendiri). Dipilih dari tanggal, jadi gratis,
// nggak butuh AI, dan bergantian: tiap hari beda, nggak ada yang berulang sebelum semuanya keluar.

export const KUTIPAN: string[] = [
  "Wake up, motherfucker. Barbel nggak bakal ngangkat dirinya sendiri.",
  "Lo bilang capek? Orang yang lo pengen jadi itu nggak pernah bilang gitu.",
  "Alasan lo itu kayak sampah: banyak, bau, dan nggak ada yang mau.",
  "Don't be weak, anjing. 75 kg itu nggak bakal naik sendiri.",
  "Kasur itu nyaman. Dan itu alasan kenapa lo masih jadi versi yang sama kayak bulan lalu.",
  "Mau six-pack tapi maunya rebahan? Bangun, bangsat.",
  "Nggak ada yang peduli lo capek. Besi di rak juga nggak peduli.",
  "Hari ini lo bisa jadi orang yang nyesel, atau orang yang keringetan. Pilih.",
  "Motivasi itu bullshit. Disiplin itu: bangun, berangkat, angkat. Titik.",
  "Lo nggak kurang waktu. Lo kurang malu sama diri sendiri.",
  "Lo punya waktu scroll 2 jam tapi nggak punya 60 menit buat badan lo sendiri? Wow.",
  "Yesterday you said tomorrow. Well, motherfucker, it's tomorrow.",
  "Orang lemah nunggu mood. Orang kuat berangkat walau males.",
  "18 kg hari ini, 20 kg minggu depan. Kecuali lo milih jadi pecundang yang bolos.",
  "Gym itu sepi karena kebanyakan orang males kayak lo versi sekarang. Jangan gabung mereka.",
  "Lo bukan capek. Lo cuma takut nggak enak. Nggak enaknya sebentar, penyesalannya lama.",
  "Tiap lo skip, ada orang lain yang lagi ngeset ke-4 dan ngelewatin lo.",
  "Stop negosiasi sama diri sendiri. Lo nggak bakal menang debat lawan kasur.",
  "Lo kerja keras di kantor buat bos lo. Kerja keras dikit buat badan lo sendiri, bisa?",
  "Be a savage, not a snacker. Taruh HP, ambil besi.",
  "Pengen pacar lo bangga? Bukan dengan rebahan seharian, bro.",
  "1 jam di gym itu cuma 4% dari hari lo. Lo mau kalah sama 4%?",
  "Lebaran udah deket. Mau tetep gitu-gitu aja? Jangan cuma dipikirin, goblok. Angkat.",
  "Nggak ada yang lahir kuat. Mereka cuma berhenti bacot dan mulai ngangkat.",
  "Sakit karena disiplin itu sementara. Sakit karena nyesel itu lama.",
  "Lo nggak butuh pre-workout. Lo butuh harga diri.",
  "Get your lazy ass up. Semua alasan lo kebayar di rak dumbbell.",
  "Telat itu masih lebih baik daripada nggak sama sekali. Berangkat sekarang.",
  "Progres nggak datang dari niat. Progres datang dari set yang lo selesaiin walau pengen kabur.",
  "Kalau gampang, semua orang berotot. Berarti lo harus lebih keras kepala dari mereka.",
  "Satu sesi bolos jadi dua, dua jadi seminggu. Putus rantainya hari ini.",
  "Don't count the reps, make the reps count. Dan jangan ngeluh sambil ngangkat.",
  "Lo udah ngeluh 5 menit. Dalam 5 menit itu lo bisa kelar 1 set. Ayo.",
  "Tubuh lo ngikutin apa yang lo kasih. Kasih dia besi, bukan alasan.",
  "Berat badan nggak naik sendiri. Makan, angkat, ulang. Jangan sok diet.",
  "Jangan jadi orang yang 'dulu pernah rajin'.",
  "Lo bukan korban keadaan. Lo korban kemalasan lo sendiri, dan lo bisa ngelawannya sekarang.",
  "Pagi atau malam, bebas. Tapi 'nggak hari ini' itu bukan pilihan.",
  "Hard work beats talent when talent doesn't work hard. Lo ngapain masih baca ini? Berangkat.",
  "Yang nyakitin bukan beban 20 kg. Yang nyakitin itu tetap di titik yang sama setahun lagi.",
  "Capek itu cuma perasaan. Bolos itu catatan. Mana yang mau lo tulis hari ini?",
  "Berhenti ngecek progres di cermin. Cek di logbook. Dan logbook lo kosong hari ini.",
  "Kalau lo masih bisa ngetik, lo masih bisa angkat besi.",
  "Nobody's coming to save you. Lo yang harus ngangkat badan lo sendiri.",
  "Lo nggak butuh 'siap'. Lo butuh mulai. Set pertama, sekarang.",
  "Pecundang bilang 'besok'. Pemenang udah di rak dumbbell.",
  "Konsistensi itu membosankan, makanya cuma sedikit yang punya hasilnya. Jadi orang yang membosankan itu.",
  "Lo udah tau harus ngapain. Yang kurang cuma satu: ngelakuin, bangsat.",
  "Gua nggak peduli lo lagi nggak mood. Mood nggak bikin otot.",
  "Ngeluh nggak ngebakar kalori. Treadmill iya. 20 menit.",
  "Lo bukan lemah. Lo cuma belum cukup marah sama kondisi lo sekarang.",
  "Katanya mau 75 kg. Timbangan nggak baca niat lo, cuma baca makan dan besi.",
  "Mulai dari satu set. Sisanya biasanya ikut sendiri. Berangkat dulu, jangan banyak drama.",
  "Weak men skip. Strong men show up when it sucks.",
  "Pegel setelah latihan itu bukti. Sakit hati karena skip itu penyesalan. Pilih bukti.",
  "Badan yang lo pengen itu udah ada, ketutup alasan lo. Kupas satu per satu, set demi set.",
  "Lo bayar gym buat apa? Buat dekor? Pake dong, anjing.",
  "Lawan lo cuma satu: lo yang kemarin. Kalahin dia hari ini.",
  "Don't stop when you're tired. Stop when you're done. Dan lo belum done.",
  "Rasa malas lo itu pengecut. Jangan kasih dia kursi di kepala lo.",
  "Orang yang lo kagumin di gym itu juga pernah males. Bedanya, dia tetep berangkat.",
  "Satu-satunya set yang nyesel itu adalah set yang nggak lo kerjain.",
];

/** Setelah latihan selesai: pengakuan singkat, tetap dengan gaya yang sama. */
export const KUTIPAN_SELESAI: string[] = [
  "Gitu dong. Lo bukan pecundang hari ini.",
  "Done. Hari ini lo ngalahin versi lo yang males.",
  "Respect. Besok ulangi, jangan cepet puas.",
  "Nah, itu baru lo. Makan yang bener, tidur yang cukup.",
  "Satu hari lagi di bank disiplin. Terus nabung.",
  "Keringetnya udah dibayar tunai. Proteinnya jangan lupa.",
  "Mantap, bangsat. Eh maksudnya mantap, bro. Pulang, makan, istirahat.",
  "Yang lain masih mikirin, lo udah ngerjain. Itu bedanya.",
];

function hariKe(tanggal: string): number {
  return Math.round(Date.UTC(+tanggal.slice(0, 4), +tanggal.slice(5, 7) - 1, +tanggal.slice(8, 10)) / 86_400_000);
}

function fpb(a: number, b: number): number {
  return b === 0 ? a : fpb(b, a % b);
}

/** Pilih kutipan buat tanggal "YYYY-MM-DD": loncat dengan langkah yang saling-prima dengan jumlah kutipan, jadi semuanya keluar sekali sebelum ada yang berulang. */
export function kutipanUntuk(tanggal: string, daftar: string[] = KUTIPAN): string {
  const n = daftar.length;
  if (n === 0) return "";
  let langkah = Math.max(1, Math.floor(n / 3));
  while (fpb(langkah, n) !== 1) langkah++;
  const idx = (((hariKe(tanggal) * langkah) % n) + n) % n;
  return daftar[idx];
}

export const kutipanHariIni = (tanggal: string) => kutipanUntuk(tanggal, KUTIPAN);
export const kutipanSelesai = (tanggal: string) => kutipanUntuk(tanggal, KUTIPAN_SELESAI);
