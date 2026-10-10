# balap-karung
Balap Karung
Game balap karung berbasis website dengan karakter pixel. Bisa dimainkan melawan AI atau bersama teman secara online (maksimal 4 pemain per room).
Fitur
VS AI dengan tiga tingkat: mudah, sedang, sulit
VS Player: BUAT ROOM (mendapat kode 4 karakter) dan MASUK ROOM (memasukkan kode dari teman)
Maksimal 4 pemain per room
Karakter pixel, dibuat dengan HTML5 Canvas
Tanpa server sendiri: multiplayer memakai PeerJS (WebRTC)
Cara bermain
Tekan tombol ∆ kiri dan kanan bergantian untuk loncat jauh.
Menekan tombol yang sama berulang kali membuat loncatan lebih pendek.
Pemain pertama yang sampai garis finis menang.
Di keyboard: A / D, Z / X, atau panah kiri / kanan.
Main multiplayer
Pemain pertama memilih VS Player → BUAT ROOM, lalu membagikan kode room.
Pemain lain memilih VS Player → MASUK ROOM dan memasukkan kode itu.
Pembuat room menekan Mulai setelah minimal 2 pemain masuk.
Pembuat room bertindak sebagai host yang mengatur jalannya lomba. Jika host keluar, room ditutup.
Struktur file
File
Isi
index.html
Halaman dan menu
style.css
Tampilan
game.js
Logika game, AI, dan multiplayer
Menjalankan
Buka index.html di browser. Mode VS AI berjalan tanpa internet setelah font dimuat; mode VS Player butuh internet.
Publikasi lewat GitHub Pages
Upload ketiga file ke repository (jangan dalam bentuk .zip).
Buka Settings → Pages.
Pilih branch main, folder / (root), lalu Save.
Game aktif di https://username.github.io/nama-repo.
Pengaturan yang bisa diubah di game.js
LV: kecepatan dan tingkat kesalahan AI untuk tiap tingkat
HOP_GOOD / HOP_BAD: jarak loncatan
HOP_DUR: durasi satu loncatan
COLORS: warna baju tiap pemain
Catatan
Koneksi antar-pemain bisa gagal di sebagian jaringan data seluler. Jika terjadi, coba gunakan Wi-Fi yang sama.
