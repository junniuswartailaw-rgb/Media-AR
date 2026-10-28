/*
 * Ganti musik bawaan untuk semua pengguna:
 * 1. Simpan file musik di assets/sounds/, misalnya backsound.mp3.
 * 2. Isi defaultSrc seperti contoh di bawah ini, lalu simpan file.
 * 3. Buka ulang index.html dan nyalakan musik.
 *
 * defaultSrc: './assets/sounds/backsound.mp3',
 *
 * Kosongkan defaultSrc untuk memakai melodi bawaan RuangRia.
 * Pengguna juga dapat memilih musik sendiri lewat tombol Ganti musik.
 */
window.RUANGRIA_AUDIO_CONFIG = {
  defaultSrc: '',
  defaultName: 'Musik dari folder aplikasi',
  defaultVolume: 25,
  standalone: true
};