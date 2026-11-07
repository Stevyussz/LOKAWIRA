import {
  CulturalObjectSample,
  CulturalSpot,
  CulturalVibe,
  IssuedVoucher,
  ReservationPass,
  UnlockedLoreCard,
} from "@/types/lokawira";

export const VIBE_METADATA: Record<
  CulturalVibe,
  {
    id: CulturalVibe;
    label: string;
    region: string;
    character: string;
    centerCoords: { lat: number; lng: number };
  }
> = {
  majapahit: {
    id: "majapahit",
    label: "Majapahit (Jawa Timur)",
    region: "Kawasan Cagar Budaya Trowulan, Mojokerto",
    character: "Bata Terakota & Kuningan Surya",
    centerCoords: { lat: -7.5561, lng: 112.3828 },
  },
  sogan: {
    id: "sogan",
    label: "Mataraman (Yogyakarta & Solo)",
    region: "Kawasan Pusaka Kotagede, Yogyakarta",
    character: "Sogan Klasik & Emas Keris",
    centerCoords: { lat: -7.8295, lng: 110.4009 },
  },
  bahari: {
    id: "bahari",
    label: "Bahari Pesisir (Jalur Rempah)",
    region: "Kawasan Pusaka Lasem, Rembang",
    character: "Zamrud Laut & Cyan Mutiara",
    centerCoords: { lat: -6.6953, lng: 111.4521 },
  },
  tridatu: {
    id: "tridatu",
    label: "Bali & Nusa Tenggara",
    region: "Desa Wisata Seni Kamasan, Klungkung",
    character: "Merah Tridatu & Perak Padas",
    centerCoords: { lat: -8.5441, lng: 115.4052 },
  },
  ukiran: {
    id: "ukiran",
    label: "Toraja & Kalimantan",
    region: "Kawasan Adat Kete Kesu, Toraja Utara",
    character: "Amber Marun & Gading Ukir",
    centerCoords: { lat: -2.9992, lng: 119.9087 },
  },
};

export const INITIAL_CULTURAL_SPOTS: CulturalSpot[] = [
  // MAJAPAHIT (TROWULAN)
  {
    id: "spot-mjp-01",
    name: "Candi Bajang Ratu & Panggung Babad Surya",
    regionName: "Trowulan, Mojokerto",
    vibe: "majapahit",
    spotType: "PRIMARY_DEST",
    opkCategory: "Cagar Budaya",
    coordinates: { lat: -7.5682, lng: 112.3987 },
    address: "Jl. Candi Tikus No. 9, Temon, Kec. Trowulan, Mojokerto",
    facilities: ["Jalur Kursi Roda", "Audio Guide Lokal", "Pos P3K", "Parkir Terpadu"],
    quota: {
      currentVisitors: 142,
      maxCapacity: 150,
      estimatedWaitMinutes: 35,
      nextAvailableSlot: "14:30 WIB",
    },
    quest: {
      riddleTitle: "Teka-Teki Gerbang Paduraksa",
      riddleClue:
        "Di sayap kaki gapura bata merah, tersembunyi relief Sri Tanjung yang menunggang ikan menuju alam keabadian. Pindai relief atau celengan terakota di sanggar selatan sejauh 180 meter.",
      targetObjectPrompt: "Relief Sri Tanjung atau Celengan Terakota Majapahit",
      verifiedLoreSource: "PPKD Kabupaten Mojokerto & Maestro Perajin Terakota Mbah Suroso",
      loreNarrative:
        "Gapura Bajang Ratu merupakan pintu suci berarsitektur Paduraksa dari abad ke-14. Bata merahnya direkatkan tanpa semen melalui teknik gosok air tradisional (kosod) yang diwariskan kepada perajin terakota Trowulan hingga kini.",
      rewardPoints: 150,
      voucherReward: {
        merchantName: "Sanggar Kriya Terakota Citra Majapahit",
        discountTitle: "Potongan Kriya & Kelas Membentuk Tanah Liat",
        discountAmount: 15000,
        minimumSpend: 35000,
      },
    },
  },
  {
    id: "spot-mjp-02",
    name: "Sanggar Kriya Terakota Citra Majapahit",
    regionName: "Trowulan, Mojokerto",
    vibe: "majapahit",
    spotType: "SANGGAR_SENI",
    opkCategory: "Teknologi Tradisional",
    coordinates: { lat: -7.5691, lng: 112.3999 },
    address: "Dusun Kraton RT 03/RW 01, Temon, Trowulan (180m dari Bajang Ratu)",
    facilities: ["Tungku Pembakaran Tradisional", "Meja Putar Tanah Liat", "Galeri Mini"],
    quota: {
      currentVisitors: 8,
      maxCapacity: 30,
      estimatedWaitMinutes: 0,
      nextAvailableSlot: "Tersedia Langsung",
    },
    quest: {
      riddleTitle: "Jejak Penabung Keping Gobog",
      riddleClue:
        "Hewan hutan berbadan bulat yang perutnya menyimpan keping logam masa silam. Temukan dan pindai wujudnya di meja perajin untuk membuka voucer langsung.",
      targetObjectPrompt: "Celengan Babi Terakota Majapahit",
      verifiedLoreSource: "Komunitas Perajin Tanah Liat Temon & BPCB Jawa Timur",
      loreNarrative:
        "Kata 'celengan' dalam bahasa Indonesia berakar dari patung babi hutan (celeng) berbahan terakota yang dibuat warga Majapahit sejak abad ke-13 sebagai wadah menabung uang kepeng.",
      rewardPoints: 200,
      voucherReward: {
        merchantName: "Sanggar Kriya Terakota Citra Majapahit",
        discountTitle: "Voucer Souvenir Figur Terakota Asli",
        discountAmount: 15000,
        minimumSpend: 30000,
      },
    },
  },
  {
    id: "spot-mjp-03",
    name: "Wedang Pokak & Sambel Wader Buarni",
    regionName: "Trowulan, Mojokerto",
    vibe: "majapahit",
    spotType: "UMKM_KULINER",
    opkCategory: "Pengetahuan Tradisional",
    coordinates: { lat: -7.5674, lng: 112.3976 },
    address: "Gang Prasasti No. 4, seberang Kolam Segaran, Trowulan",
    facilities: ["Gazebo Bambu", "Pembayaran QRIS", "Dapur Terbuka"],
    // contoh jam buka: di luar jam ini check-in & scan ditolak
    openingHours: { days: [], open: "07:00", close: "23:00" },
    quota: {
      currentVisitors: 14,
      maxCapacity: 40,
      estimatedWaitMinutes: 5,
      nextAvailableSlot: "Tersedia Langsung",
    },
    quest: {
      riddleTitle: "Seduhan Rempah Penjaga Stamina Prajurit",
      riddleClue:
        "Aroma serai, kayu manis, cengkeh, dan gula aren yang mengepul dari cangkir tanah liat. Pindai cangkir gerabah sajiannya untuk mengklaim potongan kuliner.",
      targetObjectPrompt: "Cangkir Gerabah Wedang Pokak & Cobek Wader",
      verifiedLoreSource: "Katalog Kuliner Pusaka Mojokerto (PPKD 2025)",
      loreNarrative:
        "Racikan rempah pokak dan ikan wader sungai Brantas merupakan sajian pemulih tenaga masyarakat agraris lembah Brantas yang mempertahankan pengolahan di atas tungku kayu.",
      rewardPoints: 120,
      voucherReward: {
        merchantName: "Wedang Pokak & Sambel Wader Buarni",
        discountTitle: "Potongan Paket Wader Krispi + Wedang Pokak",
        discountAmount: 10000,
        minimumSpend: 25000,
      },
    },
  },

  // SOGAN (KOTAGEDE YOGYAKARTA)
  {
    id: "spot-sgn-01",
    name: "Kompleks Cepuri & Sendang Seliran Kotagede",
    regionName: "Kotagede, Yogyakarta",
    vibe: "sogan",
    spotType: "PRIMARY_DEST",
    opkCategory: "Ritus",
    coordinates: { lat: -7.8295, lng: 110.4009 },
    address: "Jl. Watu Gilang, Purbayan, Kec. Kotagede, Kota Yogyakarta",
    facilities: ["Pemandu Abdi Dalem", "Penyewaan Kain Jarik", "Ruang Tunggu Teduh"],
    quota: {
      currentVisitors: 88,
      maxCapacity: 100,
      estimatedWaitMinutes: 25,
      nextAvailableSlot: "15:00 WIB",
    },
    quest: {
      riddleTitle: "Lorong Rukunan Di Antara Dua Dinding",
      riddleClue:
        "Menyusuri jalan sempit di antara rumah kalang dan tembok batu tua, dengarkan denting palu perak dari bengkel di timur gerbang.",
      targetObjectPrompt: "Ukiran Perak Filigri & Ornamen Rumah Kalang",
      verifiedLoreSource: "Forum Heritage Kotagede & Maestro Perak Pak Harjono",
      loreNarrative:
        "Jalan Rukunan terbentuk dari kesepakatan warga Kotagede yang merelakan sela halaman rumah mereka menjadi lorong publik bersama, menjadi simbol harmoni sosial masyarakat Mataram.",
      rewardPoints: 160,
      voucherReward: {
        merchantName: "Bengkel Perak Filigri Sogan Mulia",
        discountTitle: "Voucer Kelas Merangkai Benang Perak & Cendera Mata",
        discountAmount: 20000,
        minimumSpend: 50000,
      },
    },
  },
  {
    id: "spot-sgn-02",
    name: "Bengkel Perak Filigri Sogan Mulia",
    regionName: "Kotagede, Yogyakarta",
    vibe: "sogan",
    spotType: "UMKM_KRIYA",
    opkCategory: "Teknologi Tradisional",
    coordinates: { lat: -7.8286, lng: 110.4021 },
    address: "Lorong Rukunan RT 12, Purbayan, Kotagede (140m dari Sendang Seliran)",
    facilities: ["Demo Tempa Perak", "Sertifikat Keaslian Kriya", "Pojok Teh Jawa"],
    quota: {
      currentVisitors: 6,
      maxCapacity: 20,
      estimatedWaitMinutes: 0,
      nextAvailableSlot: "Tersedia Langsung",
    },
    quest: {
      riddleTitle: "Benang Logam Selembut Sutra",
      riddleClue:
        "Pilin kawat perak murni yang dirangkai menjadi kelopak bunga melati tanpa cetakan mesin. Pindai karya filigri di etalase kayu jati.",
      targetObjectPrompt: "Bros Perak Filigri Motif Melati Kotagede",
      verifiedLoreSource: "Serikat Perajin Perak Kotagede (PPKD DIY)",
      loreNarrative:
        "Teknik filigri Kotagede memilin benang perak berdiameter kurang dari 0,5 milimeter secara manual menggunakan pinset tembaga dan api tiup tradisional.",
      rewardPoints: 210,
      voucherReward: {
        merchantName: "Bengkel Perak Filigri Sogan Mulia",
        discountTitle: "Potongan Langsung Kriya Perak Kotagede",
        discountAmount: 20000,
        minimumSpend: 45000,
      },
    },
  },
  {
    id: "spot-sgn-03",
    name: "Kipo Panggang Daun Pisang Mbok Djinten",
    regionName: "Kotagede, Yogyakarta",
    vibe: "sogan",
    spotType: "UMKM_KULINER",
    opkCategory: "Tradisi Lisan",
    coordinates: { lat: -7.8304, lng: 110.3998 },
    address: "Jl. Mondorakan No. 27, Jagalan, Kotagede",
    facilities: ["Tungku Arang Asli", "Kemasan Anyaman Bambu"],
    quota: {
      currentVisitors: 9,
      maxCapacity: 25,
      estimatedWaitMinutes: 5,
      nextAvailableSlot: "Tersedia Langsung",
    },
    quest: {
      riddleTitle: "Kudapan Hijau Bertanya 'Iki Opo?'",
      riddleClue:
        "Kue mungil seukuran ibu jari dari tepung ketan dan unti kelapa nangka yang dipanggang di atas cobek tanah liat.",
      targetObjectPrompt: "Kue Kipo Panggang di Atas Daun Pisang",
      verifiedLoreSource: "Arsip Tradisi Lisan Kuliner Mataram (Dinas Kebudayaan DIY)",
      loreNarrative:
        "Nama 'Kipo' lahir dari pertanyaan 'Iki opo?' (Ini apa?) dalam tradisi lisan warga Mataram abad ke-16 saat mencicipi kue ketan hijau beraroma daun suji dan panggang arang.",
      rewardPoints: 130,
      voucherReward: {
        merchantName: "Kipo Panggang Daun Pisang Mbok Djinten",
        discountTitle: "Gratis 1 Besek Kipo Hangat Setiap Pembelian Paket Oleh-Oleh",
        discountAmount: 12000,
        minimumSpend: 24000,
      },
    },
  },

  // BAHARI (LASEM REMBANG)
  {
    id: "spot-bhr-01",
    name: "Rumah Merah Heritage & Galeri Tiga Negeri Lasem",
    regionName: "Lasem, Rembang",
    vibe: "bahari",
    spotType: "PRIMARY_DEST",
    opkCategory: "Pengetahuan Tradisional",
    coordinates: { lat: -6.6953, lng: 111.4521 },
    address: "Jl. Karangturi Gang IV No. 2, Lasem, Kabupaten Rembang",
    facilities: ["Perpustakaan Jalur Rempah", "Sumur Tua Pewarna Alam", "Ruang Diskusi"],
    quota: {
      currentVisitors: 56,
      maxCapacity: 60,
      estimatedWaitMinutes: 30,
      nextAvailableSlot: "13:45 WIB",
    },
    quest: {
      riddleTitle: "Merah Darah Ayam yang Tak Terbantahkan",
      riddleClue:
        "Kain pesisir yang menggabungkan motif burung hong, bunga seruni, dan latohan rumput laut. Pindai canting atau lembar batik tulis di sanggar tetangga.",
      targetObjectPrompt: "Kain Batik Tulis Tiga Negeri Motif Latohan",
      verifiedLoreSource: "Yayasan Lasem Heritage & Maestro Batik Mbah Putri Sekar",
      loreNarrative:
        "Batik Tiga Negeri Lasem memadukan warna merah mengkudu khas air sumur mineral kapur Lasem dengan biru indigo dan sogan, menjadi bukti akulturasi damai Nusantara selama berabad-abad.",
      rewardPoints: 180,
      voucherReward: {
        merchantName: "Sanggar Batik Tulis Sekar Kencana Lasem",
        discountTitle: "Voucer Kelas Nyanting Pesisir & Kain Syal Batik",
        discountAmount: 25000,
        minimumSpend: 60000,
      },
    },
  },
  {
    id: "spot-bhr-02",
    name: "Kopi Lelet & Lontong Tuyuhan Cak Narto",
    regionName: "Lasem, Rembang",
    vibe: "bahari",
    spotType: "UMKM_KULINER",
    opkCategory: "Seni",
    coordinates: { lat: -6.6962, lng: 111.4534 },
    address: "Simpang Karangturi No. 11, Lasem (160m dari Rumah Merah)",
    facilities: ["Meja Lukis Ampas Kopi", "Panggung Musik Keroncong Pesisir"],
    quota: {
      currentVisitors: 11,
      maxCapacity: 35,
      estimatedWaitMinutes: 0,
      nextAvailableSlot: "Tersedia Langsung",
    },
    quest: {
      riddleTitle: "Seni Melukis dengan Ampas Kopi",
      riddleClue:
        "Bukan sekadar diseruput, endapan kopi sehalus bedak di cangkir ini digunakan warga pesisir untuk membatik motif halusan.",
      targetObjectPrompt: "Cangkir Kopi Lelet & Sajian Lontong Tuyuhan",
      verifiedLoreSource: "Komunitas Kopi Lelet Rembang (PPKD Jawa Tengah)",
      loreNarrative:
        "Tradisi 'ngelelet' di Lasem mengolah biji kopi robusta sangrai arang yang digiling ekstra halus hingga ampasnya dapat dipakai melukis motif batik pesisir.",
      rewardPoints: 125,
      voucherReward: {
        merchantName: "Kopi Lelet & Lontong Tuyuhan Cak Narto",
        discountTitle: "Potongan Paket Lontong Tuyuhan + Kopi Lelet Bubuk",
        discountAmount: 10000,
        minimumSpend: 25000,
      },
    },
  },

  // TRIDATU (KAMASAN BALI)
  {
    id: "spot-trd-01",
    name: "Bale Kambang Kertha Gosa & Desa Lukis Kamasan",
    regionName: "Klungkung, Bali",
    vibe: "tridatu",
    spotType: "PRIMARY_DEST",
    opkCategory: "Seni",
    coordinates: { lat: -8.5441, lng: 115.4052 },
    address: "Jl. Untung Surapati, Semarapura, Kabupaten Klungkung, Bali",
    facilities: ["Audio Narasi Tantri", "Jalur Pejalan Kaki", "Bale Istirahat"],
    quota: {
      currentVisitors: 112,
      maxCapacity: 120,
      estimatedWaitMinutes: 30,
      nextAvailableSlot: "15:15 WIB",
    },
    quest: {
      riddleTitle: "Warna Alam dari Batu Padas & Tulang",
      riddleClue:
        "Langit-langit bale pengadilan yang bertutur tentang hukum karma Bhima Swarga. Kunjungi sanggar pelukis di Banjar Sangging untuk memindai kanvas kain belacu.",
      targetObjectPrompt: "Lukisan Wayang Klasik Kamasan di Kain Belacu",
      verifiedLoreSource: "Sanggar Lukis Klasik Banjar Sangging & Maestro Mangku Mura Archive",
      loreNarrative:
        "Lukisan klasik Kamasan menggunakan pewarna mineral alami: putih dari tulang terbakar, merah dari batu gincu, kuning dari tanah atal, dan hitam dari jelaga lampu minyak kelapa.",
      rewardPoints: 190,
      voucherReward: {
        merchantName: "Sanggar Lukis Wayang Kamasan Astika",
        discountTitle: "Voucer Karya Lukis Miniatur & Kelas Mewarna Mineral",
        discountAmount: 20000,
        minimumSpend: 50000,
      },
    },
  },

  // UKIRAN (KETE KESU TORAJA)
  {
    id: "spot-ukr-01",
    name: "Kampung Adat Tongkonan Kete Kesu",
    regionName: "Toraja Utara, Sulawesi Selatan",
    vibe: "ukiran",
    spotType: "PRIMARY_DEST",
    opkCategory: "Adat Istiadat",
    coordinates: { lat: -2.9992, lng: 119.9087 },
    address: "Kelurahan Pantanakan Lolo, Kec. Kesu, Kabupaten Toraja Utara",
    facilities: ["Pusat Informasi Adat", "Lumbung Alang", "Bale Tenun & Ukir"],
    quota: {
      currentVisitors: 78,
      maxCapacity: 85,
      estimatedWaitMinutes: 25,
      nextAvailableSlot: "14:45 WIB",
    },
    quest: {
      riddleTitle: "Empat Warna Sakral Passura' Toraja",
      riddleClue:
        "Pahatan kayu nangka berpola tanduk kerbau dan matahari terbit dengan warna tanah liat merah, jelaga hitam, kapur putih, dan kunyit kuning.",
      targetObjectPrompt: "Papan Ukiran Pa'barre Allo & Pa'tedong Toraja",
      verifiedLoreSource: "Lembaga Adat Kete Kesu & Maestro Ukir Ne' Lamba",
      loreNarrative:
        "Setiap motif Passura' pada dinding Tongkonan adalah aksara visual tanpa huruf: Pa'barre Allo melambangkan sumber kehidupan surya, sementara Pa'tedong melambangkan kesejahteraan.",
      rewardPoints: 195,
      voucherReward: {
        merchantName: "Bale Ukir & Kopi Arabika Pulu-Pulu Ne' Lamba",
        discountTitle: "Voucer Kopi Toraja Seduh Manual & Pahatan Mini",
        discountAmount: 15000,
        minimumSpend: 35000,
      },
    },
  },
];

export const CULTURAL_OBJECT_SAMPLES: CulturalObjectSample[] = [
  {
    id: "sample-terakota",
    spotId: "spot-mjp-02",
    label: "Celengan Terakota Majapahit",
    objectName: "Celengan Babi Tanah Liat Bakar (Abad ke-14)",
    opkCategory: "Teknologi Tradisional",
    verifiedSource: "PPKD Kabupaten Mojokerto & BPCB Jawa Timur",
    visualClue: "Tekstur bata merah bakar tanpa glasir dengan celah koin gobog di punggung",
    storyResult:
      "Objek terverifikasi sebagai kriya terakota tradisi Majapahit. Dari bentuk celeng tanah liat inilah kata 'celengan' lahir dalam khazanah bahasa Nusantara sebagai simbol budaya menabung.",
    confidence: 0.98,
  },
  {
    id: "sample-filigri",
    spotId: "spot-sgn-02",
    label: "Bros Perak Filigri Kotagede",
    objectName: "Perhiasan Perak Filigri Motif Lung-lungan Melati",
    opkCategory: "Teknologi Tradisional",
    verifiedSource: "Forum Heritage Kotagede & Maestro Perak Pak Harjono",
    visualClue: "Rangkaian benang perak pilin 925 bertekstur kerawang terbuka",
    storyResult:
      "Objek terverifikasi sebagai kriya perak filigri asli Kotagede. Setiap kelopak dirangkai dari kawat perak pilin tanpa cetakan pabrik, menjaga keahlian pandai perak kerajaan Mataram.",
    confidence: 0.96,
  },
  {
    id: "sample-batik-lasem",
    spotId: "spot-bhr-01",
    label: "Batik Tulis Tiga Negeri Lasem",
    objectName: "Wastra Batik Tiga Negeri Motif Latohan & Sekar Jagad",
    opkCategory: "Pengetahuan Tradisional",
    verifiedSource: "Yayasan Lasem Heritage & Katalog OPK Rembang",
    visualClue: "Warna merah darah ayam khas air sumur kapur Lasem berpadu biru indigo",
    storyResult:
      "Objek terverifikasi sebagai Batik Tulis Tiga Negeri Lasem. Motif latohan terinspirasi dari tanaman laut pesisir utara Jawa yang melambangkan kemakmuran bahari.",
    confidence: 0.97,
  },
  {
    id: "sample-kamasan",
    spotId: "spot-trd-01",
    label: "Lukisan Wayang Klasik Kamasan",
    objectName: "Kanvas Belacu Pewarna Mineral Alam Banjar Sangging",
    opkCategory: "Seni",
    verifiedSource: "Sanggar Lukis Klasik Banjar Sangging Klungkung",
    visualClue: "Garis kontur jelaga minyak kelapa dengan pigmen batu gincu merah dan tanah atal",
    storyResult:
      "Objek terverifikasi sebagai seni lukis klasik Kamasan abad ke-17. Seluruh pigmen berasal dari batuan mineral dan tulang bakar yang dihaluskan di atas cobek batu padas.",
    confidence: 0.95,
  },
  {
    id: "sample-passura",
    spotId: "spot-ukr-01",
    label: "Ukiran Kayu Passura' Toraja",
    objectName: "Panel Ukiran Pa'barre Allo & Pa'tedong Kayu Nangka",
    opkCategory: "Seni",
    verifiedSource: "Lembaga Adat Kete Kesu Toraja Utara",
    visualClue: "Empat warna liturgi Litak (merah tanah, hitam jelaga, putih kapur, kuning kunyit)",
    storyResult:
      "Objek terverifikasi sebagai ukiran Passura' Toraja. Lingkaran surya Pa'barre Allo dan tanduk kerbau Pa'tedong merupakan doa keselamatan dan kehormatan komunitas adat.",
    confidence: 0.99,
  },
];

// voucer contoh berlaku 30 hari dr server nyala (ISO, dicek kasir)
const IN_30_DAYS = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

export const INITIAL_VOUCHERS: IssuedVoucher[] = [
  {
    code: "LKW-849201",
    signatureHash: "sha256:9f84b2c1e07a",
    spotId: "spot-mjp-02",
    merchantName: "Sanggar Kriya Terakota Citra Majapahit",
    discountTitle: "Potongan Kriya & Kelas Membentuk Tanah Liat",
    discountAmount: 15000,
    minimumSpend: 35000,
    expiresAt: IN_30_DAYS,
    status: "ACTIVE",
  },
  {
    code: "LKW-310594",
    signatureHash: "sha256:4d19a8f3b21c",
    spotId: "spot-mjp-03",
    merchantName: "Wedang Pokak & Sambel Wader Buarni",
    discountTitle: "Potongan Paket Wader Krispi + Wedang Pokak",
    discountAmount: 10000,
    minimumSpend: 25000,
    expiresAt: IN_30_DAYS,
    status: "ACTIVE",
  },
];

// satu voucer contoh yg udah kedaluwarsa: nunjukin kasir nolak voucer lewat masa berlaku
INITIAL_VOUCHERS.push({
  code: "LKW-100001",
  signatureHash: "sha256:expired-sample",
  spotId: "spot-mjp-02",
  merchantName: "Sanggar Kriya Terakota Citra Majapahit",
  discountTitle: "Potongan Kriya (contoh kedaluwarsa)",
  discountAmount: 5000,
  minimumSpend: 20000,
  expiresAt: "2026-01-01T00:00:00+07:00",
  status: "ACTIVE",
});

export const INITIAL_RESERVATIONS: ReservationPass[] = [
  {
    ticketId: "PASS-MJP-089",
    spotId: "spot-mjp-01",
    spotName: "Candi Bajang Ratu & Panggung Babad Surya",
    visitorName: "Raka Pradipta (Demo Wisatawan)",
    partySize: 2,
    scheduledSlot: "14:30 WIB",
    status: "CONFIRMED",
    circularQuestAccepted: true,
    createdAt: "Hari ini, 13:50 WIB",
  },
];

export const INITIAL_LORE_CARDS: UnlockedLoreCard[] = [
  {
    id: "lore-init-01",
    spotId: "spot-mjp-01",
    objectName: "Gapura Paduraksa Candi Bajang Ratu",
    opkCategory: "Cagar Budaya",
    verifiedSource: "PPKD Kabupaten Mojokerto & BPCB Jawa Timur",
    story:
      "Teknik gosok bata merah tanpa perekat semen (kosod) membuat struktur gapura abad ke-14 ini tahan guncangan gempa sekaligus menginspirasi perajin terakota Trowulan.",
    unlockedAt: "Tersimpan di Pustaka",
    confidenceScore: 0.98,
  },
];

// Server-side in-memory store for API routes during demo session
interface LokawiraMemoryStore {
  spots: CulturalSpot[];
  vouchers: IssuedVoucher[];
  reservations: ReservationPass[];
  aiTrainingNotes: { id: string; opkCategory: string; maestroSource: string; summary: string; updatedAt: string }[];
}

const globalForStore = globalThis as unknown as { lokawiraStore?: LokawiraMemoryStore };

export function getLokawiraStore(): LokawiraMemoryStore {
  if (!globalForStore.lokawiraStore) {
    globalForStore.lokawiraStore = {
      spots: structuredClone(INITIAL_CULTURAL_SPOTS),
      vouchers: structuredClone(INITIAL_VOUCHERS),
      reservations: structuredClone(INITIAL_RESERVATIONS),
      aiTrainingNotes: [
        {
          id: "rag-01",
          opkCategory: "Teknologi Tradisional",
          maestroSource: "PPKD Kabupaten Mojokerto & Mbah Suroso",
          summary: "Teknik kosod bata merah dan sejarah celengan terakota Majapahit abad ke-14.",
          updatedAt: "Terverifikasi Kurator",
        },
        {
          id: "rag-02",
          opkCategory: "Pengetahuan Tradisional",
          maestroSource: "Yayasan Lasem Heritage & Mbah Putri Sekar",
          summary: "Rahasia mineral air sumur kapur Lasem pada pewarnaan merah Batik Tiga Negeri.",
          updatedAt: "Terverifikasi Kurator",
        },
      ],
    };
  }
  return globalForStore.lokawiraStore;
}
