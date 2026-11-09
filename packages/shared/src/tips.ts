/**
 * "How to win" tips on each game guide page.
 *
 * Wording rule: only game-specific advice we can stand behind. Games whose rules we cannot
 * vouch for get the general property-trading tips, which hold for every Monopoly-like game.
 */
type Tips = { tr: string[]; en: string[] };

const CHART_TIP: Tips = {
  tr: ['Oyun bitince BoardBankr’ın tur tur bakiye grafiğine bakın. Kimin hangi turda öne geçtiğini görmek, bir sonraki oyunda hangi hamlenin işe yaradığını gösterir.'],
  en: ['When the game ends, look at BoardBankr’s round-by-round balance chart. Seeing who pulled ahead and when shows which moves paid off, for next time.'],
};

const PROPERTY: Tips = {
  tr: [
    'Aynı renkteki arsaları tamamlamaya odaklanın. Dağınık tek arsalar az kira getirir; bir grubu tamamladığınızda bina dikebilir ve kirayı katlayabilirsiniz.',
    'Elinizde her zaman bir kira ödemeye yetecek nakit bırakın. Son parasını binaya yatıran oyuncu, ilk büyük kirada arsa satmak ya da ipotek etmek zorunda kalır.',
    'Takastan çekinmeyin. Size az yarayan bir arsayı, sizin grubunuzu tamamlayan bir arsayla değiştirin; ama rakibin grubunu tamamlayacak takası kabul etmeyin.',
    ...CHART_TIP.tr,
  ],
  en: [
    'Go for complete colour groups. Scattered single lots earn little rent; once a group is yours you can build and multiply the rent.',
    'Always keep enough cash for one rent payment. A player who puts their last money into buildings has to sell or mortgage at the first big rent.',
    'Trade. Swap a lot that does little for you for one that completes your group, but never accept a deal that completes an opponent’s.',
    ...CHART_TIP.en,
  ],
};

const MONOPOLY: Tips = {
  tr: [
    'Turuncu arsalar en çok uğranan gruplardandır, çünkü hapisten çıkan oyuncular sık sık o bölgeye düşer. Ucuzdur ve kirası çabuk geri döner.',
    'Bir gruptaki her arsaya üç ev dikmek en verimli adımdır; kira en sert artışını üçüncü evde yapar. Otele geçmeden önce gruplarınızı üçer eve getirin.',
    'Evlerin sayısı sınırlıdır. Otele geçmek yerine evlerde kalırsanız, rakiplerinizin bina dikecek ev bulması zorlaşır.',
    'Oyunun başında hapisten hemen çıkıp arsa toplayın. Sonlara doğru tahta binalarla dolunca hapiste kalmak, sizi kira ödemekten korur.',
    ...CHART_TIP.tr,
  ],
  en: [
    'The orange group is one of the most visited, because players leaving jail often land there. It is cheap and pays for itself quickly.',
    'Three houses on every lot of a group is the best value; rent jumps the most at the third house. Get your groups to three houses before going for hotels.',
    'Houses are limited. Staying on houses instead of moving up to hotels makes it harder for opponents to find houses to build.',
    'Early on, leave jail right away and collect property. Late in the game, when the board is full of buildings, staying in jail keeps you from paying rent.',
    ...CHART_TIP.en,
  ],
};

const TIPS: Record<string, Tips> = {
  monopoly: MONOPOLY,
  'monopoly-electronic-banking': MONOPOLY,
  'hotel-tycoon': {
    tr: [
      'Arsa almakla yetinmeyin; asıl parayı otelinize açtığınız girişler kazandırır. Bir girişin önüne düşen rakip sizin otelinizde kalmak ve ödemek zorundadır.',
      'Ana binayı erken dikin. Ek binalar ana binadan sonra gelir; otel ne kadar erken açılırsa o kadar çok misafir ağırlar.',
      'Nakit ayırın. Bir konaklamanın kaç gece süreceğini zar belirler ve rakibin büyük otelinde geçen birkaç gece pahalıya patlayabilir.',
      ...CHART_TIP.tr,
    ],
    en: [
      'Owning land is not enough; the money comes from the entrances you open to your hotel. An opponent who lands in front of an entrance must stay and pay.',
      'Build the main building early. Extra buildings come after it, and the sooner a hotel opens, the more guests it takes.',
      'Keep cash aside. A die decides how many nights a stay lasts, and a few nights in an opponent’s big hotel can cost a lot.',
      ...CHART_TIP.en,
    ],
  },
  cashflow: {
    tr: [
      'Amaç zengin görünmek değil: pasif geliriniz toplam giderlerinizi geçtiği anda fare yarışından çıkarsınız. Her kararı bu hedefe göre verin.',
      'Başta küçük fırsatlara yönelin. Peşinatı düşük, aylık nakit akışı pozitif yatırımlar sizi hızla ilerletir.',
      'Borçlarınızı kapatın ve gereksiz harcamalara dikkat edin; kapanan her borç aylık giderlerinizi kalıcı olarak düşürür.',
      'Bilanço kâğıdınızı her maaş gününde güncelleyin. Nakdinizi BoardBankr tutar, siz gelir ve giderlerinize odaklanırsınız.',
    ],
    en: [
      'The goal is not to look rich: you leave the Rat Race the moment your passive income exceeds your total expenses. Judge every decision by that.',
      'Start with small deals. Investments with a low down payment and positive monthly cash flow move you forward fastest.',
      'Pay off liabilities and watch out for unnecessary spending; every debt you clear lowers your monthly expenses for good.',
      'Update your financial statement on every payday. BoardBankr keeps your cash, so you can focus on income and expenses.',
    ],
  },
  'hayat-oyunu': {
    tr: [
      'Üniversite yolu borçla başlar ama daha yüksek maaşlı mesleklerin kapısını açar; uzun bir oyunda çoğu zaman karşılığını verir.',
      'Bankadan aldığınız borcu erken kapatın. Borç faiziyle geri ödenir ve oyun sonuna kadar beklemek size daha pahalıya gelir.',
      ...CHART_TIP.tr,
    ],
    en: [
      'The college path starts with debt but opens higher-paying careers, and in a long game it usually pays off.',
      'Pay back bank loans early. They are repaid with interest, and waiting until the end of the game costs you more.',
      ...CHART_TIP.en,
    ],
  },
};

export function tipsFor(slug: string, lang: 'tr' | 'en'): string[] {
  return (TIPS[slug] ?? PROPERTY)[lang];
}
