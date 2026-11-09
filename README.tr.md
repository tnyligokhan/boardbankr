# BoardBankr: Monopoly ve masa oyunları için dijital banka

Monopoly, Molipoly, Metropol, Cashflow ve kâğıt parayla oynanan tüm masa oyunları için ücretsiz, açık kaynak dijital banka ve para takibi. Tarayıcıda çalışır, indirme gerekmez: herkes bakiyesini kendi telefonunda görür; kira, maaş ve ceza ödemeleri bir dokunuşla yapılır. Elektronik bankacılık kutusunun kart okuyucusu bozulduğunda yedek olarak da kullanılır.

[English](README.md)

## Özellikler

- Beş haneli kod ya da QR ile lobiye katılma, en fazla 8 oyuncu
- Oyuncular arası ödeme, bankadan alma/bankaya ödeme, maaş, isteğe bağlı ücretsiz otopark havuzu
- İflas: kalan para alacaklıya geçer, son kalan kazanır; kurucu oyunu erken bitirebilir
- Anlık güncelleme (WebSocket), bağlantı koparsa kaldığı yerden devam eder
- Her ödemenin benzersiz kimliği vardır; tekrar denenen istek iki kez yazılmaz
- Misafir girişi ve Google ile giriş (misafir hesabı Google hesabına yükseltilebilir, oyunlar korunur)
- Türkçe / İngilizce, açık / koyu tema, mobil ve masaüstü düzeni, oyun sırasında ekranı açık tutma

## Teknoloji

| Katman | Seçim |
|---|---|
| Sunucu | Node.js 22, TypeScript, Fastify 5, `@fastify/websocket` |
| Veritabanı | PostgreSQL 16, Drizzle ORM ve SQL migration'ları |
| Arayüz | React 19, Vite, Tailwind CSS 4, React Router 7 |
| Ortak kod | `packages/shared`: tipler, zod şemaları ve para kuralları (sunucu ve tarayıcı aynı kuralları kullanır) |
| Test | Vitest; sunucu testleri PGlite ya da gerçek PostgreSQL ile çalışır |
| Yayın | Tek Docker imajı (Coolify) |

Dış servis bağımlılığı yoktur. Google yalnızca Google ile giriş açıksa kullanılır. Yazı tipleri de uygulamayla birlikte sunulur.

```
apps/server     Fastify API, WebSocket, oturumlar, oyun servisi
apps/web        React arayüzü
packages/shared Tipler, doğrulama, oyun motoru
```

### Para işlemleri nasıl güvende?

Tarayıcı yalnızca komut gönderir ("Ayşe'ye 200 öde"). Sunucu oyun satırını `SELECT … FOR UPDATE` ile kilitler, kuralı uygular, bakiyeleri ve işlem kaydını aynı transaction'da yazar. Aynı anda gelen ödemeler sırayla işlenir. Yetersiz bakiye, oyun dışı oyuncu ya da başkasının parasını harcama gibi durumlar sunucuda reddedilir. `transactions(game_id, client_tx_id)` üzerindeki benzersiz indeks, tekrar denenen isteklerin iki kez uygulanmasını engeller.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env          # DATABASE_URL=pglite yazarsanız Docker gerekmez
npm run dev                   # http://localhost:5173
```

PostgreSQL ile çalıştırmak için `docker compose up -d db` komutunu kullanabilirsiniz. Bunun için `.env` içinde `DATABASE_URL=postgres://mdb:mdb@localhost:5432/mdb` olmalı ve `db` servisine `ports: ['5432:5432']` eklenmeli.

Komutlar: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Şema değiştiğinde `npm run db:generate` ile yeni migration üretin. Migration'lar sunucu açılırken otomatik uygulanır.

## Coolify'da yayınlama

**Önerilen: uygulama ve ayrı PostgreSQL kaynağı**

1. Coolify'da projeye **PostgreSQL 16** veritabanı ekleyin ve iç bağlantı adresini (internal URL) kopyalayın.
2. **Application → Public/Private Git Repository** seçip bu repoyu ekleyin. Build Pack: **Dockerfile**, Port: **3000**.
3. Ortam değişkenleri:
   - `DATABASE_URL`: 1. adımdaki iç adres
   - `PUBLIC_URL`: uygulamanın alan adı, örn. `https://bank.example.com` (sonunda `/` olmasın)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: isteğe bağlı
4. Domain'i bağlayın; HTTPS'i Coolify halleder. Sağlık kontrolü `GET /api/health` adresindedir ve Dockerfile'da tanımlıdır.
5. Veritabanı kaynağında **Scheduled Backups** açın (S3 ya da yerel).

**Alternatif:** Repodaki `docker-compose.yml` dosyasını "Docker Compose" kaynağı olarak yayınlayın. Bu durumda `PUBLIC_URL` ve `POSTGRES_PASSWORD` değerlerini ayarlayın ve `ports` satırını kaldırın.

### Google ile giriş

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) sayfasında **OAuth client ID** oluşturun (Web application).
2. *Authorized redirect URI*: `https://<alan-adınız>/api/auth/google/callback`
3. Client ID ve secret değerlerini ortam değişkenlerine girin. Değişkenler boşsa Google düğmesi gösterilmez.

### Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | evet | PostgreSQL bağlantı adresi |
| `PUBLIC_URL` | evet | Uygulamanın açıldığı tam adres. OAuth dönüşü ve kaynak (origin) kontrolü için kullanılır |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | hayır | Google ile giriş |
| `PORT` | hayır | Varsayılan 3000 |
| `LOG_LEVEL` | hayır | `info` (varsayılan), `warn`, `debug`… |

### Ölçeklendirme notu

Uygulama tek konteynerde çalışacak şekilde tasarlandı ve bir masa oyunu için bu fazlasıyla yeterli. Birden fazla kopya çalıştırmak gerekirse anlık güncellemelerin kopyalar arasında dağıtılması gerekir. Bunun için PostgreSQL `LISTEN/NOTIFY` kullanılabilir.

## Lisans

MIT

## Markalar

Monopoly, Hasbro, Inc.’in tescilli markasıdır; adı geçen diğer oyun adları da sahiplerine aittir. BoardBankr bağımsız, açık kaynak bir yardımcı araçtır; Hasbro ya da başka bir oyun üreticisiyle bağlantılı değildir ve onlar tarafından onaylanmamıştır. Uygulamadaki paralar sanaldır, gerçek bir değeri yoktur.
