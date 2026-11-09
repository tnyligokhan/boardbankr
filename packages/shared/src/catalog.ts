/**
 * Board games the app works with. Drives the /oyun/:slug pages, the landing list,
 * the sitemap and the server-rendered SEO markup, so all of them stay in sync.
 *
 * Wording rule: describe what the app does for each game; never claim an official
 * link with a publisher, and avoid rule details we cannot vouch for.
 */
export type GameEdition = 'classic' | 'electronic' | 'custom';

export interface CatalogText {
  /** Page heading. */
  title: string;
  /** <meta name="description">, under ~160 characters. */
  description: string;
  /** Two or three paragraphs, unique per game. */
  body: string[];
}

export interface CatalogGame {
  slug: string;
  name: string;
  /** Other spellings people search for. */
  aliases: string[];
  /** Which setup card to preselect on the new game page. */
  edition: GameEdition;
  tr: CatalogText;
  en: CatalogText;
}

export const CATALOG: CatalogGame[] = [
  {
    slug: 'monopoly',
    name: 'Monopoly',
    aliases: ['Monopoly Türkiye', 'Monopoly İstanbul', 'Monopoly Junior'],
    edition: 'classic',
    tr: {
      title: 'Monopoly için dijital banka',
      description:
        'Monopoly oynarken kağıt para saymayı bırakın. Herkes bakiyesini telefonunda görür; kira, maaş ve ceza ödemeleri tek dokunuşla yapılır.',
      body: [
        'Klasik Monopoly kutusundaki paralar yerine telefonlarınızı kullanın. Oyunu kuran kişi başlangıç parasını ve Başlangıç’tan geçince alınan maaşı seçer, diğerleri beş haneli kodla katılır.',
        'Klasik kutu için 1.500 başlangıç ve 200 maaş, elektronik bankacılık kutuları için milyonlarla oynanan ayar hazır gelir. Kendi ev kurallarınız varsa tutarları elle girebilirsiniz.',
        'Kira ödemesi, vergi, otopark havuzu ve iflas uygulamada kayıt altında tutulur. Kim kime ne zaman ödedi, oyun sonunda bile görülebilir.',
      ],
    },
    en: {
      title: 'A digital bank for Monopoly',
      description:
        'Stop counting paper money in Monopoly. Everyone sees their balance on their phone and pays rent, salary and fines with a tap.',
      body: [
        'Use your phones instead of the paper money in the Monopoly box. The host picks the starting money and the salary for passing GO; everyone else joins with a five-character code.',
        'The classic box (1,500 to start, 200 salary) and the million-scale electronic banking editions have ready-made setups, and house rules can be typed in by hand.',
        'Rent, taxes, the free parking pot and bankruptcy are all recorded, so you can always see who paid whom and when.',
      ],
    },
  },
  {
    slug: 'monopoly-electronic-banking',
    name: 'Monopoly Electronic Banking',
    aliases: ['Monopoly Elektronik Bankacılık', 'Monopoly Ultimate Banking', 'Monopoly Super Electronic Banking', 'Monopoly kart okuyucu'],
    edition: 'electronic',
    tr: {
      title: 'Monopoly Elektronik Bankacılık için yedek kart okuyucu',
      description:
        'Monopoly Elektronik Bankacılık kutunuzun kart okuyucusu bozuldu ya da pili bitti mi? Milyonluk ayarlarla telefondan oynayın, ücretsiz.',
      body: [
        'Elektronik bankacılık kutularında oyun tek bir kart okuyucuya bağlıdır; pili biten, tuşu basmayan ya da kaybolan bir cihaz bütün oyunu durdurur. BoardBankr o cihazın yerine herkesin telefonunu koyar.',
        'Milyonlarla oynanan ayar hazır gelir: 15 milyon başlangıç parası, Başlangıç’tan geçince 2 milyon maaş. Kutunuzdaki tutarlar farklıysa elle değiştirebilirsiniz.',
        'Kart takıp tuşlara basmak yerine paranızı oyuncunun piyonuna sürüklersiniz. Her ödeme kayda geçer; kimin ne ödediği oyun bittikten sonra da görülür.',
      ],
    },
    en: {
      title: 'A spare card reader for Monopoly Electronic Banking',
      description:
        'Card unit of your Monopoly Electronic Banking box broken or out of batteries? Keep playing with million-scale amounts on your phones, for free.',
      body: [
        'Electronic banking editions depend on one card unit. Flat batteries, a dead key or a lost device stop the whole game. BoardBankr replaces that unit with everyone’s phone.',
        'The million-scale setup is ready: 15 million to start and 2 million for passing GO. If your box uses different amounts, change them by hand.',
        'Instead of inserting cards and tapping keys, drag your money onto the other player’s piece. Every payment is recorded, so you can still see who paid what after the game ends.',
      ],
    },
  },
  {
    slug: 'molipoly',
    name: 'Molipoly / Molicity',
    aliases: ['Molipoly', 'Molicity', 'Moli poly'],
    edition: 'custom',
    tr: {
      title: 'Molipoly ve Molicity için dijital banka',
      description:
        'Molipoly ve Molicity oynarken kağıt paralarla uğraşmayın. Bakiyeler telefonda, ödemeler tek dokunuşla, tüm hareketler kayıt altında.',
      body: [
        'Molipoly ve Molicity gibi emlak ticareti oyunlarında en çok vakit kaybettiren şey para dağıtmak ve bozdurmaktır. Bu uygulama bankayı telefonlara taşır.',
        'Kutudaki kural kitapçığında yazan başlangıç parasını ve maaşı “Kendi kurallarınız” seçeneğiyle girin. Oyuncular kodla ya da QR kodu okutarak katılır.',
        'Arsa, kira ve ceza ödemeleri oyuncudan oyuncuya ya da bankaya anında geçer; bakiye herkesin ekranında aynı anda güncellenir.',
      ],
    },
    en: {
      title: 'A digital bank for Molipoly and Molicity',
      description: 'Play Molipoly and Molicity without paper money. Balances live on your phones and every payment takes one tap.',
      body: [
        'In property trading games like Molipoly and Molicity, handing out and changing money takes the most time. This app moves the bank onto your phones.',
        'Enter the starting money and salary from the rule book with the “House rules” option. Players join with a code or by scanning a QR code.',
        'Land, rent and fine payments move instantly between players or to the bank, and every screen updates at the same moment.',
      ],
    },
  },
  {
    slug: 'metropol',
    name: 'KS Games Metropol',
    aliases: ['Metropol', 'Metropol Emlak Ticareti Oyunu', 'KS Games Metropol', 'Emlak Ticareti Oyunu'],
    edition: 'custom',
    tr: {
      title: 'KS Games Metropol Emlak Ticareti Oyunu için dijital banka',
      description:
        'Metropol Emlak Ticareti Oyunu için ücretsiz dijital banka. Kağıt paralar kutuda kalsın, ödemeler telefondan yapılsın.',
      body: [
        'Metropol gibi emlak ticareti oyunlarında banker olmak çoğu zaman oyunu kaçırmak demektir. Uygulama bankayı herkesin telefonuna böler, kimse banker olmak zorunda kalmaz.',
        'Kutudaki başlangıç parasını ve maaşı “Kendi kurallarınız” seçeneğinden girin, para birimi olarak ₺ seçili gelir.',
        'Bina, otel ve kira ödemeleri anında karşı tarafa geçer. Bağlantısı kopan oyuncu kaldığı yerden devam eder, ödeme iki kez yazılmaz.',
      ],
    },
    en: {
      title: 'A digital bank for KS Games Metropol',
      description: 'A free digital bank for the Metropol property trading game. Leave the paper money in the box and pay from your phone.',
      body: [
        'In property trading games like Metropol, being the banker usually means missing the game. The app splits the bank across everyone’s phones.',
        'Enter the starting money and salary from the box with “House rules”.',
        'Building, hotel and rent payments reach the other player instantly. A player who loses connection picks up where they left off, and no payment is recorded twice.',
      ],
    },
  },
  {
    slug: 'asitanepoly',
    name: 'MR MEZOPO Metropol / Asitanepoly',
    aliases: ['Asitanepoly', 'Asitane Poly', 'Mezopo Metropol', 'MR MEZOPO'],
    edition: 'custom',
    tr: {
      title: 'Asitanepoly ve MR MEZOPO Metropol için dijital banka',
      description:
        'Asitanepoly ve MR MEZOPO Metropol oyunlarında bakiyeleri telefondan takip edin. Ücretsiz, hesap açmadan, internet tarayıcısında çalışır.',
      body: [
        'Adını İstanbul’un eski adı Asitane’den alan Asitanepoly ve MR MEZOPO Metropol gibi oyunlarda paranızı telefonunuzda taşıyın.',
        'Uygulama indirmeniz gerekmez; tarayıcıda açılır, oyuncular kodla katılır. Başlangıç parasını ve maaşı kutudaki kurallara göre girin.',
        'Oyun bitince sıralama ve tüm ödemelerin dökümü görünür; kazananı tartışmaya gerek kalmaz.',
      ],
    },
    en: {
      title: 'A digital bank for Asitanepoly and MR MEZOPO Metropol',
      description: 'Track balances for Asitanepoly and MR MEZOPO Metropol on your phones. Free, no account needed, runs in the browser.',
      body: [
        'Keep your money on your phone in games like Asitanepoly, named after Asitane, an old name of Istanbul, and MR MEZOPO Metropol.',
        'Nothing to install: it opens in the browser and players join with a code. Enter the starting money and salary from the box rules.',
        'When the game ends you get the standings and a full record of payments.',
      ],
    },
  },
  {
    slug: 'hotel-tycoon',
    name: 'Hotel Tycoon',
    aliases: ['Hotel', 'Hotels', 'Otel oyunu', 'Hotel Tycoon kutu oyunu'],
    edition: 'custom',
    tr: {
      title: 'Hotel Tycoon için dijital banka',
      description:
        'Hotel Tycoon oynarken otel, giriş kapısı ve konaklama ödemelerini telefondan yapın. Herkes bakiyesini anlık görür.',
      body: [
        'Hotel Tycoon’da oteller büyüdükçe ödemeler de büyür ve kağıt paralar masada dağılır. Uygulamada her oyuncunun bakiyesi kendi telefonunda durur.',
        'Kutudaki başlangıç parasını “Kendi kurallarınız” ile girin; bankadan alma, bankaya ödeme ve oyuncuya ödeme düğmeleri tüm hamleleri karşılar.',
        'Büyük tutarlar da sorun değil: kart, tutar ne kadar uzun olursa olsun ekrana sığacak şekilde küçülür.',
      ],
    },
    en: {
      title: 'A digital bank for Hotel Tycoon',
      description: 'Pay for hotels, entrances and stays in Hotel Tycoon from your phone. Everyone sees their balance live.',
      body: [
        'In Hotel Tycoon the payments grow with the hotels, and paper money spreads across the table. Here each balance stays on its owner’s phone.',
        'Enter the starting money from the box with “House rules”; collect from the bank, pay the bank and pay a player cover every move.',
        'Large amounts are fine: the balance card scales any amount to fit the screen.',
      ],
    },
  },
  {
    slug: 'anti-monopoly',
    name: 'Anti-Monopoly',
    aliases: ['Anti Monopoly', 'Antimonopoly'],
    edition: 'custom',
    tr: {
      title: 'Anti-Monopoly için dijital banka',
      description: 'Anti-Monopoly oyununda rakiplerin ve tekelcilerin paralarını telefondan yönetin. Ücretsiz dijital banka.',
      body: [
        'Anti-Monopoly’de oyuncular rakipler ve tekelciler olarak farklı kurallarla oynar, ama paranın el değiştirmesi her iki taraf için de aynıdır.',
        'Kutudaki başlangıç parasını girin, her ödeme anında karşı tarafın bakiyesine yansısın. İşlem geçmişi tartışmalı anlarda hakemlik yapar.',
      ],
    },
    en: {
      title: 'A digital bank for Anti-Monopoly',
      description: 'Manage competitor and monopolist money in Anti-Monopoly from your phones. A free digital bank.',
      body: [
        'In Anti-Monopoly players take sides as competitors or monopolists with different rules, but money changes hands the same way for both.',
        'Enter the starting money from the box and every payment shows up in the other balance instantly. The payment history settles arguments.',
      ],
    },
  },
  {
    slug: 'hepsi-benim',
    name: 'Hepsi Benim',
    aliases: ['Hepsi Benim kutu oyunu', 'Hepsi Benim oyunu'],
    edition: 'custom',
    tr: {
      title: 'Hepsi Benim oyunu için dijital banka',
      description: 'Hepsi Benim oynarken paraları telefondan yönetin. Bakiyeler anlık, ödemeler tek dokunuşla, banker gerekmez.',
      body: [
        'Hepsi Benim gibi her şeyi satın almaya çalıştığınız oyunlarda masadaki para kalabalığı hızla büyür. Uygulama bu kalabalığı ekrana taşır.',
        'Başlangıç parasını ve maaşı kutudaki kurallara göre girin. Ailecek oynarken çocuklar da bakiyesini kendi gözüyle görür.',
      ],
    },
    en: {
      title: 'A digital bank for Hepsi Benim',
      description: 'Handle the money in Hepsi Benim from your phones. Live balances, one-tap payments, no banker needed.',
      body: [
        'In games like Hepsi Benim (“It’s all mine”), where you try to buy everything, the pile of money on the table grows fast. The app moves it onto the screen.',
        'Enter the starting money and salary from the box rules. When the family plays, children can see their own balance too.',
      ],
    },
  },
  {
    slug: 'gokdelen',
    name: 'Gökdelen',
    aliases: ['Gökdelen kutu oyunu', 'Gokdelen oyunu'],
    edition: 'custom',
    tr: {
      title: 'Gökdelen oyunu için dijital banka',
      description: 'Gökdelen kutu oyununda kira ve inşaat ödemelerini telefondan yapın. Ücretsiz, kurulum gerektirmez.',
      body: [
        'Gökdelen gibi bina dikip kira topladığınız oyunlarda para trafiği yoğundur. Her ödeme uygulamada saniyeler içinde karşı tarafa geçer.',
        'Oyunu kuran kişi kutudaki tutarları girer, diğerleri kodla katılır. Telefonu kapanan oyuncu geri döndüğünde bakiyesi yerinde durur.',
      ],
    },
    en: {
      title: 'A digital bank for Gökdelen',
      description: 'Pay rent and building costs in the Gökdelen board game from your phone. Free, nothing to install.',
      body: [
        'In games like Gökdelen (“Skyscraper”), where you build and collect rent, money moves constantly. Every payment reaches the other player in seconds.',
        'The host enters the amounts from the box, everyone else joins with a code. A player whose phone turns off finds their balance waiting when they return.',
      ],
    },
  },
  {
    slug: 'milyoner',
    name: 'Milyoner',
    aliases: ['Milyoner kutu oyunu', 'Milyoner oyunu'],
    edition: 'custom',
    tr: {
      title: 'Milyoner kutu oyunu için dijital banka',
      description: 'Milyoner oyununda milyonları kağıt parayla saymayın. Bakiyeler telefonda, ödemeler tek dokunuşla.',
      body: [
        'Milyoner gibi büyük tutarlarla oynanan oyunlarda sıfırları saymak yorucudur. Uygulama tutarları noktalı ve okunaklı gösterir, hesap hatasını ortadan kaldırır.',
        'Hızlı tutar düğmeleri ve tuş takımıyla milyonluk ödemeler birkaç dokunuşta yapılır.',
      ],
    },
    en: {
      title: 'A digital bank for Milyoner',
      description: 'Don’t count millions in paper money in Milyoner. Balances on your phone, payments with a tap.',
      body: [
        'In games played with big amounts, like Milyoner (“Millionaire”), counting zeros is tiring. The app shows amounts clearly and removes counting mistakes.',
        'Quick amount buttons and a keypad make million-scale payments a few taps.',
      ],
    },
  },
  {
    slug: 'milyarder',
    name: 'Milyarder',
    aliases: ['Milyarder kutu oyunu', 'Milyarder oyunu'],
    edition: 'custom',
    tr: {
      title: 'Milyarder kutu oyunu için dijital banka',
      description: 'Milyarder oyununda milyarlarca liralık ödemeleri telefondan yapın. Tek işlemde 1 trilyona kadar tutar desteklenir.',
      body: [
        'Milyarder gibi milyarlarla oynanan oyunlar için tasarlandı: tek bir ödeme 1 trilyona kadar çıkabilir, bakiyeler ise hiç taşmadan ekrana sığar.',
        'Başlangıç parasını kutudaki kurallara göre girin. Kim kime ne ödedi, oyun boyunca kayıt altında kalır.',
      ],
    },
    en: {
      title: 'A digital bank for Milyarder',
      description: 'Make billion-scale payments in Milyarder from your phone. A single payment can be up to one trillion.',
      body: [
        'Built for games played with billions, like Milyarder (“Billionaire”): one payment can go up to a trillion and balances always fit the screen.',
        'Enter the starting money from the box rules. Every payment stays on record for the whole game.',
      ],
    },
  },
  {
    slug: 'hayat-oyunu',
    name: 'Hayat Oyunu (The Game of Life)',
    aliases: ['Hayat Oyunu', 'The Game of Life', 'Game of Life kutu oyunu'],
    edition: 'custom',
    tr: {
      title: 'Hayat Oyunu (The Game of Life) için dijital banka',
      description: 'Hayat Oyunu’nda maaş günü, vergi ve ödemeleri telefondan yapın. Kağıt paralar kutuda kalsın.',
      body: [
        'Hayat Oyunu’nda maaş günü gelir, faturalar ödenir, paralar sürekli el değiştirir. Uygulamadaki “Maaş al” düğmesi maaş gününü tek dokunuşa indirir.',
        'Maaşı “Kendi kurallarınız” ile girin; bankadan alma ve bankaya ödeme düğmeleri oyundaki diğer tüm para hareketlerini karşılar.',
      ],
    },
    en: {
      title: 'A digital bank for The Game of Life',
      description: 'Handle payday, taxes and payments in The Game of Life from your phone. Leave the paper money in the box.',
      body: [
        'In The Game of Life payday comes around, bills get paid and money changes hands constantly. The “Collect salary” button turns payday into one tap.',
        'Enter the salary with “House rules”; collect from the bank and pay the bank cover every other money move.',
      ],
    },
  },
  {
    slug: 'cashflow',
    name: 'Cashflow',
    aliases: ['Cashflow 101', 'Cashflow kutu oyunu', 'Nakit Akışı oyunu'],
    edition: 'custom',
    tr: {
      title: 'Cashflow kutu oyunu için dijital banka',
      description: 'Cashflow oynarken nakit hareketlerini telefondan takip edin. Ücretsiz dijital banka, hesap açmak gerekmez.',
      body: [
        'Cashflow’da nakit akışını izlemek oyunun kendisidir. Uygulama her oyuncunun nakdini telefonunda tutar, her ödeme kayda geçer.',
        'Maaş gününü “Maaş al” ile, alım satımları bankaya ödeme ve bankadan alma düğmeleriyle yapın.',
      ],
    },
    en: {
      title: 'A digital bank for Cashflow',
      description: 'Track cash in the Cashflow board game from your phones. A free digital bank, no account needed.',
      body: [
        'In Cashflow, tracking cash is the game itself. The app keeps each player’s cash on their phone and records every payment.',
        'Use “Collect salary” for payday, and pay the bank or collect from it for deals.',
      ],
    },
  },
];

export function findCatalogGame(slug: string): CatalogGame | undefined {
  return CATALOG.find((g) => g.slug === slug);
}

export interface FaqItem {
  q: string;
  a: string;
}

const GAME_NAMES = 'Monopoly, Molipoly, Molicity, Metropol, Asitanepoly, Hotel Tycoon, Anti-Monopoly, Hepsi Benim, Gökdelen, Milyoner, Milyarder, Hayat Oyunu ve Cashflow';

export const FAQ: Record<'tr' | 'en', FaqItem[]> = {
  tr: [
    {
      q: 'Hangi oyunlarla kullanılır?',
      a: `Kağıt parayla oynanan her masa oyunuyla: ${GAME_NAMES} bunlardan bazıları. Başlangıç parasını ve maaşı kendiniz girebildiğiniz için listede olmayan oyunlarda da çalışır.`,
    },
    {
      q: 'Ücretli mi, uygulama indirmem gerekir mi?',
      a: 'Ücretsizdir ve tarayıcıda çalışır, mağazadan bir şey indirmeniz gerekmez. İsterseniz ana ekrana ekleyip uygulama gibi açabilirsiniz.',
    },
    {
      q: 'Hesap açmak zorunlu mu?',
      a: 'Hayır. Sadece adınızı yazarak misafir olarak oynayabilirsiniz. Google ile girerseniz oyunlarınız ve istatistikleriniz her cihazda sizinle olur.',
    },
    {
      q: 'Kaç kişi oynayabilir?',
      a: 'Bir oyunda 2 ile 8 arasında oyuncu olabilir. Her oyuncu kendi telefonunu kullanır, kimse banker olmak zorunda kalmaz.',
    },
    {
      q: 'İnternet bağlantısı koparsa ne olur?',
      a: 'Bağlantı geri geldiğinde uygulama kaldığı yerden devam eder. Tekrar gönderilen bir ödeme iki kez yazılmaz, bakiyeler her zaman tutarlı kalır.',
    },
    {
      q: 'Bu resmi bir Monopoly uygulaması mı?',
      a: 'Hayır. Bağımsız, ücretsiz bir yardımcı uygulamadır; adı geçen oyunların üreticileri ve marka sahipleriyle bir bağlantısı yoktur.',
    },
  ],
  en: [
    {
      q: 'Which games does it work with?',
      a: `Any board game played with paper money, including Monopoly, Molipoly, Molicity, Metropol, Asitanepoly, Hotel Tycoon, Anti-Monopoly, Hepsi Benim, Gökdelen, Milyoner, Milyarder, The Game of Life and Cashflow. You set the starting money and salary yourself, so games not on the list work too.`,
    },
    {
      q: 'Is it free, and do I need to install anything?',
      a: 'It is free and runs in the browser, so there is nothing to download. You can add it to your home screen to open it like an app.',
    },
    {
      q: 'Do I need an account?',
      a: 'No. Type your name and play as a guest. Sign in with Google to keep your games and stats on every device.',
    },
    { q: 'How many people can play?', a: 'Two to eight players per game. Everyone uses their own phone, so nobody has to be the banker.' },
    {
      q: 'What happens if the connection drops?',
      a: 'The app picks up where it left off when the connection returns. A payment that gets resent is never recorded twice.',
    },
    {
      q: 'Is this an official Monopoly app?',
      a: 'No. It is an independent, free companion app with no connection to the makers or trademark owners of the games mentioned.',
    },
  ],
};
