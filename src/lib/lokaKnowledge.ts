// Pengetahuan Loka bawaan: fakta budaya per kawasan, disusun dr sumber yg bisa dicek (jurnal, situs pemerintah, museum,
// media). Riset November 2026. Kalau sumber berbeda pendapat, perbedaannya ditulis apa adanya biar Loka gak mengarang
// kepastian. Pengelola boleh mengubah atau menghapus lewat tab Pengetahuan Loka.
import type { OpkCategory } from "@/types/lokawira";

export interface SeedLoreNote {
  id: string;
  opkCategory: OpkCategory;
  maestroSource: string;
  summary: string;
}

export const INITIAL_LORE_NOTES: SeedLoreNote[] = [
  // ---- Majapahit (Trowulan, Mojokerto) ----
  {
    id: "rag-mjp-bajangratu",
    opkCategory: "Cagar Budaya",
    maestroSource: "Database Candi Indonesia, Perpustakaan Nasional (Candi Bajangratu); Wikipedia: Trowulan",
    summary:
      "Gapura Bajang Ratu di Desa Temon, Trowulan, Mojokerto adalah gapura bata merah bertipe paduraksa (gapura beratap) dari masa Majapahit, umumnya diperkirakan dari abad ke-14. Tradisi lisan mengaitkannya dengan Raja Jayanegara, yang menurut Kitab Pararaton wafat pada 1328: sebagian ahli menafsirkannya sebagai bangunan peruwatan untuk raja itu, sebagian lain sebagai pintu masuk kompleks kerajaan. Kaitan dengan Jayanegara adalah tafsiran, bukan kepastian. Kata 'bajang' berarti kerdil, dan sebagian arkeolog menduga nama Bajang Ratu tidak berhubungan dengan raja Majapahit.",
  },
  {
    id: "rag-mjp-relief",
    opkCategory: "Seni",
    maestroSource: "Database Candi Indonesia, Perpustakaan Nasional; Jurnal Racana Unipasby (Ragam Hias Kepala Kala Candi Bajang Ratu)",
    summary:
      "Kaki Gapura Bajang Ratu memuat relief kisah Sri Tanjung di sudut kiri depan, dan dinding depannya memuat relief Ramayana. Kisah Sri Tanjung dikenal sebagai cerita peruwatan (penyucian), dan relief ini menjadi salah satu dasar tafsiran gapura sebagai bangunan peruwatan. Bagian atas pintu gapura dihiasi kepala Kala.",
  },
  {
    id: "rag-mjp-trowulan",
    opkCategory: "Cagar Budaya",
    maestroSource: "SK Mendikbud No. 260/M/2013 tentang Penetapan Kawasan Cagar Budaya Trowulan",
    summary:
      "Satuan ruang geografis Trowulan ditetapkan sebagai Kawasan Cagar Budaya Peringkat Nasional melalui SK Mendikbud No. 260/M/2013, dengan luas 92,6 km². Di dalam kawasan ini antara lain terdapat Gapura Bajang Ratu, Kolam Segaran, dan Candi Tikus, yang dikelola balai pelestarian cagar budaya di Mojokerto.",
  },
  {
    id: "rag-mjp-segaran",
    opkCategory: "Cagar Budaya",
    maestroSource: "Situs Trowulan (Ilmu Komunikasi UNESA); detikJatim: 5 Situs Bersejarah Trowulan",
    summary:
      "Kolam Segaran di Trowulan luasnya sekitar 6,5 hektare dengan kedalaman sekitar 2,88 meter, dan disebut sebagai kolam kuno terbesar yang pernah ditemukan di Indonesia. Sekitar 2 km dari sana ada Candi Tikus, sebuah petirtaan (pemandian suci) yang diduga dipakai keluarga kerajaan. Namanya berasal dari banyaknya tikus di situs itu saat ditemukan pada 1914.",
  },
  {
    id: "rag-mjp-bata",
    opkCategory: "Teknologi Tradisional",
    maestroSource: "Republika (2012), Times Indonesia (Kolam Segaran); laporan ekskavasi Pakis Kulon, Trowulan",
    summary:
      "Dinding bangunan monumental Majapahit di Trowulan, seperti Kolam Segaran dan kolam Candi Tikus, disebut disusun dari bata tanpa bahan perekat: bata digosokkan satu sama lain sampai melekat (teknik bata gosok). Ekskavasi permukiman di Pakis Kulon justru menemukan bata yang disusun dengan perekat tanah liat, sehingga teknik gosok tampaknya dipakai untuk bangunan monumental. Penjelasan ini banyak muncul di sumber populer; kajian teknis arkeologinya masih terbatas.",
  },
  {
    id: "rag-mjp-celengan",
    opkCategory: "Teknologi Tradisional",
    maestroSource: "Liputan6 (Riwayat Celengan); Good News From Indonesia (2022); kajian Supratikno Rahardjo (1990)",
    summary:
      "Di Trowulan ditemukan celengan terakota berbentuk babi dengan lubang kecil di bagian tengah punggung, diperkirakan berasal dari abad ke-14. Celengan masa Majapahit dibuat sekitar abad ke-13 sampai ke-15 dalam tiga bentuk: manusia, hewan, dan guci. Bentuk hewan seperti babi, domba, kura-kura, dan gajah paling banyak ditemukan. Arkeolog Supratikno Rahardjo (1990) mengkaji tradisi menabung masyarakat Majapahit dari temuan ini; jumlah celengan yang pernah dibuat tidak diketahui. Salah satu celengan babi Majapahit disimpan di Museum Nasional Jakarta.",
  },
  {
    id: "rag-mjp-perajin",
    opkCategory: "Teknologi Tradisional",
    maestroSource: "Jurnal Art Nouveau (Universitas Dinamika); jurnal Imajinasi UNM (Cor Kuningan Bejijong); repositori UPN Jatim",
    summary:
      "Perajin terakota yang bertahan di Trowulan tinggal sedikit: satu kajian mencatat 5 perajin, 3 di antaranya dari Desa Jatipasar, yang masih mewarisi motif terakota masa Majapahit. Desa Bejijong di Trowulan dikenal sebagai sentra kerajinan cor kuningan dengan sekitar 160 unit usaha, sedangkan Desa Watesumpak dikenal sebagai sentra patung batu.",
  },
  {
    id: "rag-mjp-pokak",
    opkCategory: "Pengetahuan Tradisional",
    maestroSource: "Jurnal UWC Unimus (Transformasi Wedang Pokak); jurnal Daya Saing UMS",
    summary:
      "Wedang pokak adalah minuman rempah hangat dari Jawa Timur yang diracik dari jahe, kayu manis, daun jeruk, serai, dan gula. Kajian yang ditemukan menyebutnya minuman khas masyarakat Probolinggo. Belum ada sumber yang menyebut wedang pokak berasal dari Mojokerto atau tercatat sebagai Warisan Budaya Takbenda.",
  },

  // ---- Mataraman (Kotagede, Yogyakarta) ----
  {
    id: "rag-sgn-kotagede",
    opkCategory: "Cagar Budaya",
    maestroSource: "Berkala Arkeologi (BRIN); Dinas Perpustakaan dan Arsip DIY (Komplek Masjid dan Makam Kotagede)",
    summary:
      "Kotagede adalah ibu kota awal Kesultanan Mataram Islam di masa Panembahan Senopati, pada akhir abad ke-16. Tahunnya berbeda antarsumber; salah satunya menyebut Kotagede menjadi ibu kota sekitar 1586 sampai 1613, sebelum Sultan Agung memindahkan pusat kerajaan ke Karta, sekitar 5 km di selatan. Tata kotanya mengikuti konsep catur gatra tunggal yang menghubungkan keraton, masjid, pasar, dan alun-alun. Pasar Gede menjadi pusat ekonomi sejak masa kerajaan.",
  },
  {
    id: "rag-sgn-masjid",
    opkCategory: "Cagar Budaya",
    maestroSource: "Skripsi UIN Sunan Kalijaga (Akulturasi Budaya dalam Arsitektur Masjid Gedhe Mataram); Good News From Indonesia (2024)",
    summary:
      "Masjid Gedhe Mataram Kotagede disebut sebagai masjid tertua di Yogyakarta dan berada satu kompleks dengan Makam Raja-raja Mataram. Tahun pembangunannya berbeda antarsumber, antara 1578–1587 dan 1585–1601. Arsitekturnya dikaji sebagai bentuk akulturasi budaya. Masjid ini kini dikelola Keraton Yogyakarta bersama dinas kebudayaan daerah.",
  },
  {
    id: "rag-sgn-busana",
    opkCategory: "Adat Istiadat",
    maestroSource: "Dinas Perpustakaan dan Arsip DIY; Museum Sonobudoyo (Busana Pranakan); i-discoverasia Kotagede Walk",
    summary:
      "Untuk masuk ke makam utama Kompleks Makam Raja-raja Mataram Kotagede, peziarah wajib berbusana adat Jawa: laki-laki memakai peranakan atau beskap dengan blangkon, perempuan memakai kemben dan kain jarik. Keris yang dibawa harus dilepas sebelum masuk cungkup makam. Busana peranakan menjadi seragam resmi abdi dalem sejak masa Sri Sultan Hamengku Buwono V. Aturan bisa berubah, jadi sebaiknya tanyakan langsung ke abdi dalem di lokasi.",
  },
  {
    id: "rag-sgn-seliran",
    opkCategory: "Ritus",
    maestroSource: "detikJogja (Kisah Sendang Seliran; Bulus dan Lele Sendang Seliran); skripsi UIN Sunan Kalijaga (Tradisi Nawu Sendang Seliran)",
    summary:
      "Sendang Seliran di sisi selatan Kompleks Makam Raja-raja Mataram Kotagede terdiri dari Sendang Kakung dan Sendang Putri. Lele hidup di Sendang Kakung dan bulus (kura-kura) di Sendang Putri; lele di sendang tidak boleh diambil. Nama seliran dikaitkan dengan kata selira (badan), karena airnya dipercaya bersumber dari makam Panembahan Senopati. Juru kunci memperkirakan sendang dibangun sekitar 1587, tetapi tahun pastinya tidak diketahui. Setiap tahun ada tradisi Nawu Sendang Seliran untuk menguras dan mengganti air sendang.",
  },
  {
    id: "rag-sgn-rukunan",
    opkCategory: "Adat Istiadat",
    maestroSource: "Dinas Perpustakaan dan Arsip DIY (Jalan Rukunan di Kotagede); i-discoverasia (Between Two Gates)",
    summary:
      "Kampung Alun-alun di Kotagede dikenal sebagai Between Two Gates: deretan rumah joglo saling berhadapan, dan lorong di antaranya ditutup gerbang di kedua ujung. Penjelasan nama ini merujuk kajian tim arsitektur UGM tahun 1986. Lorong seperti ini disebut jalan rukunan, yaitu jalan bersama warga yang menjadi ruang hidup bersama dan cerminan kerukunan di Kotagede.",
  },
  {
    id: "rag-sgn-perak",
    opkCategory: "Teknologi Tradisional",
    maestroSource: "Jurnal Humaniora UGM (Daliman, Industri Seni Kerajinan Perak DIY); tatkala.co (Kerajinan Logam Kotagede); UKM Indonesia",
    summary:
      "Kerajinan perak Kotagede disebut sudah ada sejak abad ke-17 (dirujuk dalam Perda Kota Yogyakarta No. 3 Tahun 2015), dan beberapa kajian menariknya ke masa Mataram abad ke-16. Kotagede dijuluki Kota Perak, dengan masa puncak tercatat pada 1935–1938. Jenis produknya antara lain filigri (perak dipilin sehingga tampak berlubang-lubang), tatah ukir (motif menonjol), dan cor. Dahulu kerajinan logam ini dipakai untuk keperluan keraton dan dijadikan perhiasan buah tangan bagi tamu kerajaan.",
  },
  {
    id: "rag-sgn-kipo",
    opkCategory: "Tradisi Lisan",
    maestroSource: "Good News From Indonesia (Kipo Iki Opo, 2016); Jurnal Aplikasia UIN Sunan Kalijaga (2022); Jurnal Gastronary AMPTA",
    summary:
      "Nama kipo berasal dari pertanyaan bahasa Jawa 'Iki opo?' (ini apa?). Menurut Bu Djito, yang dikenal sebagai pembuat awal kipo, jajanan ini dulu belum bernama sehingga pembeli sering bertanya 'iki opo'. Budayawan Kotagede Erwito Wibowo menyebut pembuat pertamanya tidak diketahui pasti, dan ada cerita bahwa kue ini sudah ada sejak masa Mataram Islam. Kajian tahun 2022 menyebut kipo hampir punah dan hanya diproduksi di sekitar Kotagede.",
  },

  // ---- Bahari (Lasem, Rembang) ----
  {
    id: "rag-bhr-lasem",
    opkCategory: "Adat Istiadat",
    maestroSource: "Pemprov Jawa Tengah (Lasem, Potret Indonesia Mini); Jurnal BECOSS Binus (Kelenteng Cu An Kiong); RRI (2024)",
    summary:
      "Lasem di Kabupaten Rembang dijuluki Tiongkok Kecil karena banyak bangunan tua berarsitektur Tionghoa, sekaligus dikenal sebagai Kota Santri. Kawasan pecinannya tersebar di tiga desa. Kelenteng Cu An Kiong di Jalan Dasun sering disebut kelenteng tertua di Jawa Tengah, tetapi tahun pendiriannya masih diperdebatkan, antara abad ke-14 dan sekitar 1450. Arsip jaringan perdagangan Lasem ditetapkan sebagai Memori Kolektif Bangsa oleh ANRI pada 29 Mei 2024.",
  },
  {
    id: "rag-bhr-wbtb",
    opkCategory: "Pengetahuan Tradisional",
    maestroSource: "Pemkab Rembang (rembangkab.go.id, 2 September 2024); Pemprov Jawa Tengah",
    summary:
      "Batik Lasem ditetapkan sebagai Warisan Budaya Takbenda Indonesia oleh Kemendikbudristek dalam sidang penetapan di Jakarta pada 21 Agustus 2024, bersama tradisi Penjamasan Bendhe Becak Sunan Bonang dari Rembang. Keduanya termasuk di antara 272 karya budaya yang ditetapkan tahun itu.",
  },
  {
    id: "rag-bhr-tiganegeri",
    opkCategory: "Pengetahuan Tradisional",
    maestroSource: "Indonesia.travel (Batik Tiga Negeri Khas Lasem); Good News From Indonesia (Batik Lasem, 2020)",
    summary:
      "Batik Tiga Negeri memakai tiga warna utama: merah, biru, dan cokelat sogan. Dahulu tiap warna dicelup di sentra berbeda: merah di Lasem, biru indigo di Pekalongan, dan sogan di Surakarta atau Yogyakarta. Setelah pewarna sintetis dipakai, batik ini bisa dibuat di satu tempat. Merah khas Lasem disebut getih pitik (merah darah ayam), dihasilkan dari akar mengkudu dan dipercaya dipengaruhi kandungan mineral air di Lasem. Ketiga warna sering dimaknai sebagai perpaduan budaya Tionghoa (merah), Belanda (biru), dan Jawa (sogan).",
  },
  {
    id: "rag-bhr-rumahmerah",
    opkCategory: "Cagar Budaya",
    maestroSource: "iNews (Rumah Merah Lasem, Simbol Akulturasi Tionghoa dan Jawa); jurnal SMART FAD UKDW",
    summary:
      "Rumah Merah di Desa Karangturi, Lasem, adalah bangunan bersejarah bergaya Tionghoa-Hindia di atas lahan lebih dari setengah hektare dengan halaman luas, didominasi warna merah. Sejak September 2016 bangunan ini dikelola sebagai penginapan Rumah Merah Tiongkok Kecil Heritage, sekaligus galeri batik dan tempat belajar budaya Tionghoa dan Jawa di Lasem. Tahun pembangunannya belum ditemukan di sumber tertulis.",
  },
  {
    id: "rag-bhr-lelet",
    opkCategory: "Seni",
    maestroSource: "Merdeka.com (Mengintip Nglelet); Kumparan Food (Kopi Lelet); jurnal SMART FAD UKDW",
    summary:
      "Nglelet adalah kebiasaan warga Lasem dan pesisir Rembang melukis batang rokok dengan ampas kopi; rokoknya disebut rokok kopi lelet. Ampas yang mengendap dipisahkan lalu dicampur sedikit gula aren supaya menempel di kertas rokok. Motifnya umumnya motif batik Lasem, digambar dengan batang korek api untuk garis tebal atau sehelai benang untuk gradasi. Warung kopi lelet juga menjadi ruang bertemunya warga Jawa dan Tionghoa di Lasem. Kapan tradisi ini mulai tidak tercatat pasti.",
  },
  {
    id: "rag-bhr-tuyuhan",
    opkCategory: "Pengetahuan Tradisional",
    maestroSource: "Jurnal JPPIPA Unram (2023); Jawa Pos; NU Online; Liputan6",
    summary:
      "Lontong tuyuhan berasal dari Desa Tuyuhan, Kecamatan Pancur, Rembang. Lontongnya berbentuk segitiga dan disajikan dengan ayam kampung berkuah santan kuning, yang disebut lebih encer dan lebih pedas daripada opor. Hidangan ini lekat dengan Lebaran dan dikaitkan dengan sejarah syiar Islam di Lasem. Sumber yang ditemukan belum menyebutnya sebagai Warisan Budaya Takbenda.",
  },

  // ---- Tridatu (Klungkung, Bali) ----
  {
    id: "rag-trd-kerthagosa",
    opkCategory: "Cagar Budaya",
    maestroSource: "detikBali (Mengunjungi Kerta Gosa); Jurnal Rekayasa Unpar (Pelestarian Arsitektur Kertha Gosa); Wikipedia: Kamasan",
    summary:
      "Kompleks Kertha Gosa di Semarapura, Klungkung menyisakan Bale Kertha Gosa (balai pengadilan terbuka kerajaan), Bale Kambang yang dikelilingi kolam Taman Gili, dan gapura kerajaan. Langit-langitnya dihiasi lukisan wayang gaya Kamasan dengan kisah antara lain Bhima Swarga (perjalanan Bhima ke surga dan neraka untuk menyelamatkan jiwa orang tuanya), Tantri, dan Adiparwa. Lukisan ini direstorasi pelukis Kamasan pada 1930 dan diperbarui lagi pada 1960-an. Kompleks ini dikelola Dinas Pariwisata Klungkung.",
  },
  {
    id: "rag-trd-kamasan",
    opkCategory: "Seni",
    maestroSource: "Wikipedia: Kamasan; detikBali (Lukisan Klasik Wayang Kamasan Sempat Diajukan ke ICH UNESCO); Antara Bali",
    summary:
      "Desa Kamasan di Klungkung bersebelahan dengan Gelgel, pusat pemerintahan Kerajaan Gelgel sekitar 1380–1651. Seni lukis klasik Bali dikenal sejak abad ke-14 dan berkembang pesat saat Dalem Waturenggong memerintah Gelgel pada pertengahan abad ke-16. Para pelukis secara tradisional tinggal di Banjar Sangging. Pemkab Klungkung mendaftarkan lukisan wayang Kamasan sebagai Warisan Budaya Takbenda, dan pada 2022 lukisan ini masuk kandidat untuk diajukan ke daftar Warisan Budaya Takbenda UNESCO.",
  },
  {
    id: "rag-trd-warna",
    opkCategory: "Seni",
    maestroSource: "Jurnal Hastagina ISI Denpasar (Pewarna Lukisan Wayang Kamasan); prosiding SENAKREASI ISI Surakarta (2025)",
    summary:
      "Pewarna alami lukisan wayang Kamasan antara lain batu pere atau batu gamping untuk kuning kecokelatan, kencu untuk merah, daun taum untuk biru, serta mangsi dan jelaga lampu minyak untuk hitam. Warna putih dibuat dari tulang babi atau tanduk rusa yang dihaluskan. Bahan warna dicampur perekat dari lem mutiara. Kini pewarna alami jarang dipakai karena bahannya sulit didapat dan pengolahannya rumit, sehingga banyak pelukis beralih ke cat pabrik.",
  },
  {
    id: "rag-trd-mangkumura",
    opkCategory: "Seni",
    maestroSource: "Wikipedia: Kamasan; Australian Museum (Mangku Mura, Balinese Artist)",
    summary:
      "Mangku Mura (1920–1999) adalah salah satu pelukis wayang Kamasan terkemuka, dikenal luas lewat kerja samanya dengan antropolog Anthony Forge. Ia tidak berasal dari keluarga pelukis dan tinggal di luar Banjar Sangging. Ia ikut mengerjakan pembaruan lukisan Kertha Gosa pada 1960-an dan pada 2011 menerima penghargaan anumerta dari Pemerintah Indonesia atas pelestarian seni tradisional. Putrinya, Mangku Muriati, juga pelukis Kamasan ternama.",
  },

  // ---- Toraja (Toraja Utara, Sulawesi Selatan) ----
  {
    id: "rag-ukr-ketekesu",
    opkCategory: "Cagar Budaya",
    maestroSource: "UNESCO World Heritage Centre (Daftar Tentatif); Jurnal Ilmu Budaya Unhas; Good News From Indonesia (2025)",
    summary:
      "Menurut berkas UNESCO, kompleks Ke'te' Kesu' di Toraja Utara terdiri dari 6 tongkonan dan 12 alang (lumbung padi). Kawasan ini masuk daftar tentatif Warisan Dunia UNESCO, belum ditetapkan, dan ditetapkan sebagai cagar budaya oleh Pemkab Toraja Utara. Sebagian tongkonannya disebut berumur sekitar 300 tahun. Alang berdiri di sisi utara tongkonan dan dianggap pasangan tongkonan. Riwayat lokasinya berbeda antarsumber: ahli waris menyebut kompleks ini dulu berada di puncak gunung batu.",
  },
  {
    id: "rag-ukr-kuburan",
    opkCategory: "Adat Istiadat",
    maestroSource: "Direktori Pariwisata (Kete Kesu); Good News From Indonesia (Rumah Adat dan Kuburan Batu Kete Kesu, 2021)",
    summary:
      "Di dekat kompleks Ke'te' Kesu' terdapat kuburan batu yang diperkirakan berusia lebih dari 500 tahun. Sebagian peti kuburnya berbentuk seperti perahu dan menggantung di atas gua, berisi sisa tengkorak dan tulang. Kuburan ini berkaitan dengan upacara kematian Rambu Solo'.",
  },
  {
    id: "rag-ukr-passura",
    opkCategory: "Seni",
    maestroSource: "Jurnal IJPSS UNM (Amanat Suci Leluhur Toraja Lewat Simbol Passura'); Jurnal Maspul (Makna Ukiran Alang)",
    summary:
      "Passura' adalah ukiran Toraja pada dinding tongkonan dan alang. Pa'barre Allo berbentuk lingkaran matahari bersinar, dimaknai sebagai lambang ketuhanan dan kesatuan, juga harapan agar ilmu dan kearifan memberi kehidupan seperti sinar matahari. Pa'manuk Londong (ayam jantan) dipasang di depan atau belakang rumah dan lumbung di atas Pa'barre Allo, dimaknai sebagai norma dan aturan yang datang dari langit. Pa'tedong menyerupai wajah kerbau dan dimaknai sebagai kemakmuran; menurut satu sumber, ukiran ini menandai bahwa rumah itu adalah tongkonan. Tafsir motif berbeda antarsumber.",
  },

  // ---- Pandhalungan (Jember), kawasan draf ----
  {
    id: "rag-pdl-canmacanan",
    opkCategory: "Seni",
    maestroSource: "Jurnal Imaji UNY (Makna Simbolik Can-macanan Kaddhuk); jurnal Avatara UNESA; skripsi Universitas Jember (2023)",
    summary:
      "Can Macanan Kadduk adalah seni pertunjukan Pandhalungan dari Jember yang memadukan budaya Jawa dan Madura. Kesenian ini tercatat dalam daftar kekayaan budaya takbenda Indonesia dengan nomor registrasi 2014004573. Satu sumber menyebut kesenian ini lahir dari keresahan petani yang gagal panen di Desa Tegalboto, Jember. Kajian terbaru mencatat eksistensinya menurun karena maraknya kesenian modern.",
  },
];

// catatan bawaan versi lama (sumbernya belum bisa dicek). Diganti catatan bersumber di atas;
// di DB yg udah jalan cuma dihapus kalo isinya belum pernah diubah pengelola
export const LEGACY_NOTE_SUMMARIES: Record<string, string> = {
  "rag-01": "Teknik kosod bata merah dan sejarah celengan terakota Majapahit abad ke-14.",
  "rag-02": "Rahasia mineral air sumur kapur Lasem pada pewarnaan merah Batik Tiga Negeri.",
};
