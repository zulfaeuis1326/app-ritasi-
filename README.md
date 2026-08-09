# Aplikasi Ritasi Hauler

Next.js (frontend + backend jadi satu) + PostgreSQL. Dirancang biar deploy di Railway simpel.

## Fitur
- Nomor unit (bisa tambah unit sendiri)
- Jam real-time & auto ganti jam (server-side, jadi tidak tergantung jam browser)
- Master material aktif: OB, COAL, SOIL, SOLU, MUD
- Clicker ritasi — nempel ke material aktif & jam berjalan
- Rekap per jam (per unit) dengan rincian material dalam satu sel, contoh: `4 (OB:2, COAL:2)`
- Rincian total material per unit
- Tutup shift manual (shift 1: 07:00–19:00, shift 2/malam: 19:00–07:00) — data terkunci setelah ditutup
- Export Excel otomatis begitu shift ditutup, plus riwayat shift lama bisa didownload ulang
- **Data tersimpan di PostgreSQL** — refresh browser, ganti device, atau server restart, data tetap aman (tidak pakai localStorage)

## Cara deploy ke Railway

1. **Push project ini ke GitHub** (repo baru).
2. Di Railway: **New Project → Deploy from GitHub repo**, pilih repo ini.
3. Di project yang sama, klik **+ New → Database → PostgreSQL**. Railway otomatis
   membuat variabel `DATABASE_URL` dan menyambungkannya ke service Next.js kamu
   (pastikan reference variable `DATABASE_URL` sudah ke-link ke service app-nya —
   biasanya otomatis kalau satu project).
4. Tambahkan environment variable di service Next.js:
   - `TZ_NAME` = `Asia/Jakarta` (ganti sesuai lokasi tambang: `Asia/Makassar` untuk WITA, `Asia/Jayapura` untuk WIT)
5. Railway otomatis jalankan `npm install` lalu `npm run build` lalu `npm start`.
   Tabel database **dibuat otomatis** saat request pertama masuk (tidak perlu migrasi manual).
6. Buka domain yang diberikan Railway → aplikasi siap dipakai. Tambahkan unit-unit
   hauler pertama kali lewat form "Tambah Unit" di halaman utama.

## Menjalankan secara lokal (opsional, untuk development)

```bash
npm install
# buat file .env.local berisi DATABASE_URL (bisa pakai Postgres lokal atau
# "railway connect" untuk connect ke DB Railway langsung dari laptop)
npm run dev
```

## Struktur singkat
```
pages/
  index.js              -> halaman utama (clicker, rekap, tutup shift)
  api/units.js           -> kelola daftar unit
  api/ritasi.js           -> catat klik ritasi + ambil rekap shift berjalan
  api/shift/close.js      -> tutup shift manual
  api/shift/export.js     -> export Excel
  api/shift/list.js       -> riwayat shift
lib/
  db.js                  -> koneksi PostgreSQL + auto-buat tabel
  time.js                -> logika jam & penentuan shift (timezone-aware)
  recap.js               -> agregasi data (dipakai tampilan & Excel biar konsisten)
  shift.js               -> ambil/bikin shift yang sedang terbuka
  materials.js           -> daftar material tetap
```
