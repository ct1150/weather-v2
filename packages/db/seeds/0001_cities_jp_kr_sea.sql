-- Seed 0001 — Tourist cities of Japan, South Korea and Southeast Asia (DATA-GEOGRAPHY-001).
--
-- This file is NOT a migration. CI only applies packages/db/migrations/0001_weather.sql
-- and explicitly forbids 0002. Seeds live here and are executed manually via the
-- @wnr/weather-sync package scripts (seed:prod / seed:preview).
--
-- All statements use INSERT OR IGNORE so the file is idempotent: re-running it on a
-- database that already contains the rows is a no-op and never raises a duplicate error.
--
-- Insertion order matters because of foreign keys:
--   countries -> country_translations
--   countries -> cities -> city_translations
--
-- created_at / updated_at use a fixed literal so repeated runs stay deterministic.
-- search_weight defaults to 1.0 for every seeded city.

-- ---------------------------------------------------------------------------
-- 1. Countries (must precede cities and country_translations)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO countries (id, iso2, iso3, default_timezone, slug, status, created_at, updated_at) VALUES
  ('jp', 'JP', 'JPN', 'Asia/Tokyo', 'japan', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kr', 'KR', 'KOR', 'Asia/Seoul', 'south-korea', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('th', 'TH', 'THA', 'Asia/Bangkok', 'thailand', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('vn', 'VN', 'VNM', 'Asia/Ho_Chi_Minh', 'vietnam', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('sg', 'SG', 'SGP', 'Asia/Singapore', 'singapore', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('my', 'MY', 'MYS', 'Asia/Kuala_Lumpur', 'malaysia', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('id', 'ID', 'IDN', 'Asia/Jakarta', 'indonesia', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('ph', 'PH', 'PHL', 'Asia/Manila', 'philippines', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kh', 'KH', 'KHM', 'Asia/Phnom_Penh', 'cambodia', 'active', '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z');

-- ---------------------------------------------------------------------------
-- 2. Country translations (en + zh for every country)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO country_translations (country_id, locale, name) VALUES
  ('jp', 'en', 'Japan'),
  ('jp', 'zh', '日本'),
  ('kr', 'en', 'South Korea'),
  ('kr', 'zh', '韩国'),
  ('th', 'en', 'Thailand'),
  ('th', 'zh', '泰国'),
  ('vn', 'en', 'Vietnam'),
  ('vn', 'zh', '越南'),
  ('sg', 'en', 'Singapore'),
  ('sg', 'zh', '新加坡'),
  ('my', 'en', 'Malaysia'),
  ('my', 'zh', '马来西亚'),
  ('id', 'en', 'Indonesia'),
  ('id', 'zh', '印度尼西亚'),
  ('ph', 'en', 'Philippines'),
  ('ph', 'zh', '菲律宾'),
  ('kh', 'en', 'Cambodia'),
  ('kh', 'zh', '柬埔寨');

-- ---------------------------------------------------------------------------
-- 3. Cities (country_id must already exist; is_featured = 1 marks featured cities)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO cities (id, country_id, slug, latitude, longitude, timezone, population, is_featured, status, search_weight, created_at, updated_at) VALUES
  ('jp-tokyo', 'jp', 'tokyo', 35.6762, 139.6503, 'Asia/Tokyo', 13960000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('jp-osaka', 'jp', 'osaka', 34.6937, 135.5023, 'Asia/Tokyo', 2691000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('jp-kyoto', 'jp', 'kyoto', 35.0116, 135.7681, 'Asia/Tokyo', 1460000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('jp-sapporo', 'jp', 'sapporo', 43.0618, 141.3545, 'Asia/Tokyo', 1970000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('jp-fukuoka', 'jp', 'fukuoka', 33.5904, 130.4017, 'Asia/Tokyo', 1610000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('jp-naha', 'jp', 'naha', 26.2124, 127.6809, 'Asia/Tokyo', 317000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kr-seoul', 'kr', 'seoul', 37.5665, 126.9780, 'Asia/Seoul', 9720000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kr-busan', 'kr', 'busan', 35.1796, 129.0756, 'Asia/Seoul', 3400000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kr-jeju', 'kr', 'jeju', 33.4996, 126.5312, 'Asia/Seoul', 660000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kr-incheon', 'kr', 'incheon', 37.4563, 126.7052, 'Asia/Seoul', 2960000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('th-bangkok', 'th', 'bangkok', 13.7563, 100.5018, 'Asia/Bangkok', 10530000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('th-phuket', 'th', 'phuket', 7.8804, 98.3923, 'Asia/Bangkok', 400000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('th-chiang-mai', 'th', 'chiang-mai', 18.7883, 98.9853, 'Asia/Bangkok', 130000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('th-pattaya', 'th', 'pattaya', 12.9236, 100.8825, 'Asia/Bangkok', 120000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('th-krabi', 'th', 'krabi', 8.0863, 98.9063, 'Asia/Bangkok', 55000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('vn-hanoi', 'vn', 'hanoi', 21.0278, 105.8342, 'Asia/Ho_Chi_Minh', 8050000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('vn-ho-chi-minh', 'vn', 'ho-chi-minh', 10.8231, 106.6297, 'Asia/Ho_Chi_Minh', 9000000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('vn-da-nang', 'vn', 'da-nang', 16.0544, 108.2022, 'Asia/Ho_Chi_Minh', 1200000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('vn-hoi-an', 'vn', 'hoi-an', 15.8801, 108.3380, 'Asia/Ho_Chi_Minh', 50000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('sg-singapore', 'sg', 'singapore', 1.3521, 103.8198, 'Asia/Singapore', 5900000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('my-kuala-lumpur', 'my', 'kuala-lumpur', 3.1390, 101.6869, 'Asia/Kuala_Lumpur', 8000000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('my-penang', 'my', 'penang', 5.4164, 100.3327, 'Asia/Kuala_Lumpur', 2500000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('my-langkawi', 'my', 'langkawi', 6.3500, 99.8000, 'Asia/Kuala_Lumpur', 99000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('my-malacca', 'my', 'malacca', 2.1896, 102.2501, 'Asia/Kuala_Lumpur', 580000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('id-bali', 'id', 'bali', 8.6705, 115.2126, 'Asia/Jakarta', 4300000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('id-jakarta', 'id', 'jakarta', 6.2088, 106.8456, 'Asia/Jakarta', 10560000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('id-yogyakarta', 'id', 'yogyakarta', 7.7972, 110.3688, 'Asia/Jakarta', 370000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('ph-manila', 'ph', 'manila', 14.5995, 120.9842, 'Asia/Manila', 14500000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('ph-cebu', 'ph', 'cebu', 10.3157, 123.8854, 'Asia/Manila', 1000000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('ph-boracay', 'ph', 'boracay', 11.9674, 121.9248, 'Asia/Manila', 32000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kh-siem-reap', 'kh', 'siem-reap', 13.3524, 103.8564, 'Asia/Phnom_Penh', 250000, 1, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z'),
  ('kh-phnom-penh', 'kh', 'phnom-penh', 11.5564, 104.9282, 'Asia/Phnom_Penh', 2200000, 0, 'active', 1.0, '2026-07-23T00:00:00Z', '2026-07-23T00:00:00Z');

-- ---------------------------------------------------------------------------
-- 4. City translations (en + zh for every city; summaries avoid apostrophes)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO city_translations (city_id, locale, name, summary) VALUES
  ('jp-tokyo', 'en', 'Tokyo', 'Capital of Japan, famous for skyscrapers, historic temples and cherry blossoms.'),
  ('jp-tokyo', 'zh', '东京', '日本首都，以摩天楼、古寺与樱花闻名。'),
  ('jp-osaka', 'en', 'Osaka', 'Food capital of Japan with vibrant nightlife and Osaka Castle.'),
  ('jp-osaka', 'zh', '大阪', '日本美食之都，夜生活热闹，有大阪城。'),
  ('jp-kyoto', 'en', 'Kyoto', 'Former imperial capital rich in temples, shrines and geisha districts.'),
  ('jp-kyoto', 'zh', '京都', '昔日日本都城，寺庙神社与祇园艺伎区众多。'),
  ('jp-sapporo', 'en', 'Sapporo', 'Hokkaido hub known for snow festivals and ramen.'),
  ('jp-sapporo', 'zh', '札幌', '北海道中心城市，以雪祭与拉面著称。'),
  ('jp-fukuoka', 'en', 'Fukuoka', 'Kyushu gateway city with yatai food stalls.'),
  ('jp-fukuoka', 'zh', '福冈', '九州门户城市，以屋台小吃摊闻名。'),
  ('jp-naha', 'en', 'Naha', 'Capital of Okinawa, gateway to tropical beaches.'),
  ('jp-naha', 'zh', '那霸', '冲绳首府，通往热带海滩的门户。'),
  ('kr-seoul', 'en', 'Seoul', 'Capital of South Korea, known for palaces, K-pop and street food.'),
  ('kr-seoul', 'zh', '首尔', '韩国首都，宫殿、K-pop 与街头美食之都。'),
  ('kr-busan', 'en', 'Busan', 'Coastal city with beaches, markets and temples.'),
  ('kr-busan', 'zh', '釜山', '海滨城市，有海滩、市场与寺庙。'),
  ('kr-jeju', 'en', 'Jeju', 'Volcanic resort island with beaches and hiking trails.'),
  ('kr-jeju', 'zh', '济州岛', '火山度假岛，有海滩与徒步路线。'),
  ('kr-incheon', 'en', 'Incheon', 'Port city with Chinatown and airport hub.'),
  ('kr-incheon', 'zh', '仁川', '港口城市，有唐人街与空港枢纽。'),
  ('th-bangkok', 'en', 'Bangkok', 'Capital of Thailand, known for temples, markets and street food.'),
  ('th-bangkok', 'zh', '曼谷', '泰国首都，寺庙、市场与街头美食之都。'),
  ('th-phuket', 'en', 'Phuket', 'Largest island of Thailand, famous for beaches and nightlife.'),
  ('th-phuket', 'zh', '普吉岛', '泰国最大岛屿，以海滩与夜生活闻名。'),
  ('th-chiang-mai', 'en', 'Chiang Mai', 'Northern Thailand city of temples and mountains.'),
  ('th-chiang-mai', 'zh', '清迈', '泰国北部古城，寺庙与山地环绕。'),
  ('th-pattaya', 'en', 'Pattaya', 'Seaside resort town near Bangkok.'),
  ('th-pattaya', 'zh', '芭堤雅', '曼谷附近的海滨度假城镇。'),
  ('th-krabi', 'en', 'Krabi', 'Limestone cliffs and calm Andaman beaches.'),
  ('th-krabi', 'zh', '甲米', '石灰岩峭壁与安达曼海静谧海滩。'),
  ('vn-hanoi', 'en', 'Hanoi', 'Capital of Vietnam, known for lakes and old-quarter charm.'),
  ('vn-hanoi', 'zh', '河内', '越南首都，湖泊与老城风情。'),
  ('vn-ho-chi-minh', 'en', 'Ho Chi Minh City', 'Economic hub of Vietnam with French colonial architecture.'),
  ('vn-ho-chi-minh', 'zh', '胡志明市', '越南经济中心，有法式殖民建筑。'),
  ('vn-da-nang', 'en', 'Da Nang', 'Central coast city with beaches and the Golden Bridge.'),
  ('vn-da-nang', 'zh', '岘港', '中部沿海城市，有海滩与黄金桥。'),
  ('vn-hoi-an', 'en', 'Hoi An', 'Lantern-lit ancient trading town.'),
  ('vn-hoi-an', 'zh', '会安', '灯笼摇曳的古老商埠小镇。'),
  ('sg-singapore', 'en', 'Singapore', 'Compact city-state of gardens, malls and hawker food.'),
  ('sg-singapore', 'zh', '新加坡', '花园城市国家，商场与熟食中心林立。'),
  ('my-kuala-lumpur', 'en', 'Kuala Lumpur', 'Capital of Malaysia with the Petronas Towers.'),
  ('my-kuala-lumpur', 'zh', '吉隆坡', '马来西亚首都，有双子塔。'),
  ('my-penang', 'en', 'Penang', 'Heritage island of street art and hawker food.'),
  ('my-penang', 'zh', '槟城', '有街头艺术与小吃的遗产之岛。'),
  ('my-langkawi', 'en', 'Langkawi', 'Duty-free island with beaches and cable car.'),
  ('my-langkawi', 'zh', '兰卡威', '免税岛，有海滩与缆车。'),
  ('my-malacca', 'en', 'Malacca', 'Historic strait city with colonial architecture.'),
  ('my-malacca', 'zh', '马六甲', '历史海峡城市，殖民建筑众多。'),
  ('id-bali', 'en', 'Bali', 'Resort island of Indonesia with beaches and temples.'),
  ('id-bali', 'zh', '巴厘岛', '印尼度假岛，海滩与庙宇林立。'),
  ('id-jakarta', 'en', 'Jakarta', 'Bustling capital of Indonesia on Java.'),
  ('id-jakarta', 'zh', '雅加达', '印尼繁忙的爪哇岛首都。'),
  ('id-yogyakarta', 'en', 'Yogyakarta', 'Javanese cultural city near Borobudur temple.'),
  ('id-yogyakarta', 'zh', '日惹', '靠近婆罗浮屠的爪哇文化古城。'),
  ('ph-manila', 'en', 'Manila', 'Philippines capital with Intramuros old town.'),
  ('ph-manila', 'zh', '马尼拉', '菲律宾首都，有 intramuros 老城。'),
  ('ph-cebu', 'en', 'Cebu', 'Visayas hub of beaches and whale shark tours.'),
  ('ph-cebu', 'zh', '宿务', '米沙鄢枢纽，有海滩与鲸鲨游。'),
  ('ph-boracay', 'en', 'Boracay', 'Small island famous for White Beach.'),
  ('ph-boracay', 'zh', '长滩岛', '以小长白沙滩闻名的小岛。'),
  ('kh-siem-reap', 'en', 'Siem Reap', 'Gateway to the Angkor Wat temples.'),
  ('kh-siem-reap', 'zh', '暹粒', '吴哥窟寺庙群的门户。'),
  ('kh-phnom-penh', 'en', 'Phnom Penh', 'Riverside capital of Cambodia.'),
  ('kh-phnom-penh', 'zh', '金边', '柬埔寨滨河首都。');
