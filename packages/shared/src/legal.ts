/**
 * The legal notice (/yasal). Shared so the page and the server-rendered copy for crawlers
 * say the same thing. Keep every statement true to what the app actually does: what it
 * stores, which cookie it sets, that there is no real money, ads or tracking.
 */
export interface LegalSection {
  title: string;
  body: string[];
}

export interface LegalText {
  title: string;
  description: string;
  lead: string;
  updated: string;
  sections: LegalSection[];
}

/** Bump with any change to the text. */
export const LEGAL_UPDATED = '2026-11-09';

const GAME_NAMES =
  'Molipoly, Molicity, Metropol, Asitanepoly, MR MEZOPO, Hotel Tycoon, Anti-Monopoly, Hepsi Benim, Gökdelen, Milyoner, Milyarder, Hayat Oyunu (The Game of Life) ve Cashflow';
const GAME_NAMES_EN =
  'Molipoly, Molicity, Metropol, Asitanepoly, MR MEZOPO, Hotel Tycoon, Anti-Monopoly, Hepsi Benim, Gökdelen, Milyoner, Milyarder, The Game of Life and Cashflow';

export const LEGAL: Record<'tr' | 'en', LegalText> = {
  tr: {
    title: 'Yasal uyarı',
    description: 'BoardBankr’ın marka sahipleriyle ilişkisi, sanal para, saklanan veriler ve sorumluluk sınırları hakkında bilgiler.',
    lead: 'BoardBankr, masa oyunlarında kâğıt para yerine kullanılan ücretsiz ve bağımsız bir yardımcı uygulamadır. Uygulamayı kullanarak aşağıdakileri kabul etmiş olursunuz.',
    updated: 'Son güncelleme: 9 Kasım 2026',
    sections: [
      {
        title: 'Markalar ve bağımsızlık',
        body: [
          'Monopoly, Hasbro, Inc.’in tescilli markasıdır. ' +
            GAME_NAMES +
            ' adları ve bunlara ait markalar, logolar ve tasarımlar ilgili sahiplerine aittir.',
          'BoardBankr bu şirketlerin hiçbiriyle bağlantılı değildir; onlar tarafından desteklenmez, onaylanmaz ya da lisanslanmaz. Oyun adları yalnızca uygulamanın hangi oyunlarla birlikte kullanılabileceğini anlatmak için anılır.',
          'BoardBankr bir oyun değildir. Oyun tahtası, kart, kural kitabı ya da başka bir oyun içeriği sunmaz; oynamak için oyunun kendi kutusuna sahip olmanız gerekir.',
        ],
      },
      {
        title: 'Sanal para',
        body: [
          'Uygulamadaki bakiyeler ve ödemeler yalnızca oyun içi puanlardır. Gerçek para değildir, parasal bir değeri yoktur ve nakde ya da başka bir şeye çevrilemez.',
          'Uygulamada para yatırma, ödeme alma veya satın alma yoktur. BoardBankr kumar ya da bahis için tasarlanmamıştır ve bu amaçla kullanılmamalıdır.',
        ],
      },
      {
        title: 'Verileriniz ve çerezler',
        body: [
          'Uygulamanın çalışması için yalnızca şunlar saklanır: masada görünen adınız, Google ile giriş yaparsanız Google hesabınızın e-posta adresi, katıldığınız oyunlar (oyuncular, bakiyeler, işlem ve tur geçmişi).',
          'Oturumunuzu hatırlamak için tek bir zorunlu çerez kullanılır; 90 gün geçerlidir ve sayfadaki betikler tarafından okunamaz. Dil, ses ve ekranın açık kalması tercihleri yalnızca kendi tarayıcınızda saklanır.',
          'Reklam yoktur; analiz veya takip araçları kullanılmaz. Verileriniz satılmaz ve reklam amacıyla kimseyle paylaşılmaz. Google, yalnızca Google ile giriş yapmayı seçerseniz devreye girer.',
          'Misafir olarak oynarsanız hesabınız yalnızca o tarayıcıda hatırlanır; çıkış yaparsanız ya da tarayıcı verilerini silerseniz o hesaba geri dönülemez. Verilerinizin silinmesini istiyorsanız aşağıdaki iletişim yolundan yazabilirsiniz.',
        ],
      },
      {
        title: 'Sorumluluğun sınırı',
        body: [
          'BoardBankr “olduğu gibi” sunulur. Kesintisiz ya da hatasız çalışacağı, bakiyelerin ve oyun kayıtlarının her zaman korunacağı garanti edilmez.',
          'Oyundaki anlaşmazlıklarda son söz oyuncuların ve oyunun kendi kurallarınındır. Uygulamanın kullanımından doğabilecek zararlardan, yürürlükteki hukukun izin verdiği ölçüde geliştirici sorumlu tutulamaz.',
        ],
      },
      {
        title: 'Açık kaynak ve iletişim',
        body: [
          'BoardBankr’ın kaynak kodu MIT lisansıyla GitHub’da yayımlanır. Hata bildirimi, öneri ve veri silme talepleri için projenin GitHub sayfasındaki “Issues” bölümünü kullanabilirsiniz.',
        ],
      },
    ],
  },
  en: {
    title: 'Legal notice',
    description: 'How BoardBankr relates to the trademark owners, why its money is not real, what it stores and the limits of its responsibility.',
    lead: 'BoardBankr is a free, independent helper app that replaces the paper money in board games. By using it you accept the following.',
    updated: 'Last updated: 9 November 2026',
    sections: [
      {
        title: 'Trademarks and independence',
        body: [
          'Monopoly is a registered trademark of Hasbro, Inc. ' +
            GAME_NAMES_EN +
            ', and their trademarks, logos and designs, belong to their respective owners.',
          'BoardBankr is not affiliated with any of these companies, and is not sponsored, endorsed or licensed by them. Game names appear only to say which games the app can be used with.',
          'BoardBankr is not a game. It provides no board, cards, rule book or other game content; you need your own copy of the game to play.',
        ],
      },
      {
        title: 'Play money',
        body: [
          'Balances and payments in the app are in-game points only. They are not real money, have no monetary value and cannot be exchanged for cash or anything else.',
          'There are no deposits, payments or purchases in the app. BoardBankr is not designed for gambling or betting and must not be used for it.',
        ],
      },
      {
        title: 'Your data and cookies',
        body: [
          'Only what the app needs to work is stored: the name shown at the table, your Google account’s email address if you sign in with Google, and the games you take part in (players, balances, payment and round history).',
          'One essential cookie remembers your session; it lasts 90 days and cannot be read by scripts on the page. Your language, sound and keep-screen-on choices are kept only in your own browser.',
          'There are no ads and no analytics or tracking tools. Your data is not sold or shared with anyone for advertising. Google is involved only if you choose to sign in with Google.',
          'If you play as a guest, your account is remembered only in that browser; after signing out or clearing browser data it cannot be recovered. To have your data deleted, write to us through the contact route below.',
        ],
      },
      {
        title: 'Limits of responsibility',
        body: [
          'BoardBankr is provided “as is”. There is no guarantee that it will run without interruption or errors, or that balances and game records will always be kept.',
          'In any dispute during a game, the players and the game’s own rules have the final say. To the extent the applicable law allows, the developer is not liable for any loss arising from use of the app.',
        ],
      },
      {
        title: 'Open source and contact',
        body: [
          'BoardBankr’s source code is published on GitHub under the MIT licence. For bug reports, suggestions and data deletion requests, use the “Issues” section of the project’s GitHub page.',
        ],
      },
    ],
  },
};
