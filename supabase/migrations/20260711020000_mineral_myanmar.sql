-- Minerals — Myanmar enrichment. Add structured fields for learning links and a
-- Myanmar-specific block (deposits, how they are mined and transported), then
-- seed a curated set of the country's most important metals and minerals with
-- well-documented facts. Public read is already allowed by the existing RLS on
-- public.minerals; writes here run as the migration (service role).

alter table public.minerals
  add column if not exists wikipedia_url text,
  add column if not exists youtube_query text,
  -- { "deposits": [{ "place","region","note" }], "extraction","transport","notes" }
  add column if not exists myanmar jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Curated Myanmar metals & minerals. Upsert by slug so re-running is safe and
-- so existing seed rows get the richer data.
-- ---------------------------------------------------------------------------
insert into public.minerals
  (name, slug, symbol, category, hardness_mohs, density, properties, uses,
   description, wikipedia_url, youtube_query, myanmar)
values
  (
    'Jade (Jadeite)', 'jade-jadeite', 'NaAlSi2O6', 'Silicate', 7.0, 3.3,
    '{"colour":"green, lavender, white","luster":"greasy to vitreous","crystal_system":"monoclinic"}'::jsonb,
    array['jewellery','carving','ornaments','cultural artefacts'],
    'မြန်မာနိုင်ငံသည် ကမ္ဘာ့ jadeite ကျောက်စိမ်း အများဆုံး ထွက်ရှိရာ နိုင်ငံဖြစ်သည်။ Jadeite jade is the most valuable form of jade; Myanmar supplies the vast majority of the world''s gem-quality jadeite, prized for centuries in China.',
    'https://en.wikipedia.org/wiki/Jade', 'Myanmar jade mining Hpakant',
    '{"deposits":[{"place":"Hpakant (ဖားကန့်)","region":"Kachin State","note":"ကမ္ဘာ့ အကြီးဆုံး ကျောက်စိမ်း တွင်းများ"},{"place":"Lonkin, Tawmaw","region":"Kachin State","note":"Uru boulder conglomerate"}],"extraction":"open-pit မိုင်းကြီးများနှင့် လက်လုပ်လက်စား ကျောက်ကောက်ခြင်း (yemase)","transport":"တွင်းမှ Myitkyina/Mandalay သို့ ကား/ရထားဖြင့် သယ်ယူ၍ ကျောက်စိမ်းပွဲရုံများတွင် လေလံတင်","notes":"နှစ်စဉ် Naypyitaw Gems Emporium တွင် လေလံတင်ရောင်းချသည်"}'::jsonb
  ),
  (
    'Ruby', 'ruby', 'Al2O3:Cr', 'Oxide (Corundum)', 9.0, 4.0,
    '{"colour":"pigeon-blood red","luster":"vitreous","crystal_system":"trigonal"}'::jsonb,
    array['gemstone','jewellery','investment'],
    'မိုးကုတ်ဒေသထွက် "ချိုးသွေးရောင်" ပတ္တမြားသည် ကမ္ဘာတွင် အကောင်းဆုံးဟု သတ်မှတ်ခံရသည်။ Myanmar (Mogok) rubies with the famous "pigeon-blood" colour are considered the finest in the world.',
    'https://en.wikipedia.org/wiki/Ruby', 'Mogok ruby mining Myanmar',
    '{"deposits":[{"place":"Mogok (မိုးကုတ်)","region":"Mandalay Region","note":"Valley of Rubies — marble-hosted"},{"place":"Mong Hsu (မိုင်းရှူး)","region":"Shan State","note":"1990s မှစ ရောင်းအား များ"}],"extraction":"marble နှင့် alluvial gravel မှ hand-mining, byon washing","transport":"မိုးကုတ်မှ မန္တလေး ကျောက်မျက်ဈေးကွက်သို့","notes":"corundum မိသားစု — ruby (red) နှင့် sapphire (အခြားအရောင်) တူညီသော သတ္တု"}'::jsonb
  ),
  (
    'Sapphire', 'sapphire', 'Al2O3', 'Oxide (Corundum)', 9.0, 4.0,
    '{"colour":"blue, yellow, white","luster":"vitreous","crystal_system":"trigonal"}'::jsonb,
    array['gemstone','jewellery','watch crystals'],
    'မိုးကုတ်ဒေသသည် blue sapphire အရည်အသွေးမြင့်များ ထွက်ရှိသည်။ Corundum in every colour except red is sapphire; Mogok produces prized cornflower-blue stones.',
    'https://en.wikipedia.org/wiki/Sapphire', 'Myanmar sapphire Mogok',
    '{"deposits":[{"place":"Mogok","region":"Mandalay Region","note":"ruby နှင့် အတူ ထွက်"}],"extraction":"alluvial gravel washing","transport":"မိုးကုတ် → မန္တလေး","notes":""}'::jsonb
  ),
  (
    'Spinel', 'spinel', 'MgAl2O4', 'Oxide', 8.0, 3.6,
    '{"colour":"red, pink, blue","luster":"vitreous","crystal_system":"cubic"}'::jsonb,
    array['gemstone','jewellery'],
    'မိုးကုတ်နှင့် နမ္မယဒေသ spinel များသည် ရှေးယခင်က ပတ္တမြားဟု မှားယွင်း ခေါ်ဆိုခံခဲ့ရသည်။ Many historic "rubies" were actually Burmese spinel.',
    'https://en.wikipedia.org/wiki/Spinel', 'Myanmar spinel Mogok Namya',
    '{"deposits":[{"place":"Mogok","region":"Mandalay Region","note":""},{"place":"Namya (Namyaseik)","region":"Kachin State","note":""}],"extraction":"alluvial + marble-hosted","transport":"မိုးကုတ်/နမ္မယ → မန္တလေး","notes":""}'::jsonb
  ),
  (
    'Amber (Burmite)', 'amber-burmite', 'C10H16O', 'Organic', 2.5, 1.1,
    '{"colour":"golden, red-brown","luster":"resinous","crystal_system":"amorphous"}'::jsonb,
    array['jewellery','fossil study','ornaments'],
    'ဟူးကောင်းချိုင့်ဝှမ်း Burmite သည် ~၉၉ သန်းနှစ် Cretaceous ခေတ် သစ်စေးကျောက်ဖြစ်ပြီး အင်းဆက်/တိရစ္ဆာန် အကြွင်းအကျန်များ ပါဝင်လေ့ရှိသည်။ Burmese amber is ~99-million-year-old Cretaceous resin, famous for its trapped insects.',
    'https://en.wikipedia.org/wiki/Burmese_amber', 'Burmese amber Hukawng Valley',
    '{"deposits":[{"place":"Hukawng Valley (ဟူးကောင်း)","region":"Kachin State","note":"Cretaceous amber"}],"extraction":"လက်တူးတွင်းများ","transport":"Kachin → Myitkyina/China border","notes":"palaeontology အတွက် အလွန်အရေးပါ"}'::jsonb
  ),
  (
    'Gold', 'gold', 'Au', 'Native metal', 2.75, 19.3,
    '{"colour":"golden yellow","luster":"metallic","crystal_system":"cubic"}'::jsonb,
    array['jewellery','currency reserve','electronics','investment'],
    'ဧရာဝတီ၊ ချင်းတွင်း မြစ်ကမ်းများနှင့် Kachin/Sagaing တောင်တန်းများတွင် ရွှေ ရွှေ့လျားသိုက်နှင့် ကျောက်သားသိုက်များ ရှိသည်။ Gold occurs as alluvial deposits in Myanmar''s rivers and as hard-rock ore in Kachin and Sagaing.',
    'https://en.wikipedia.org/wiki/Gold', 'gold panning mining Myanmar',
    '{"deposits":[{"place":"Kyaukpahto","region":"Sagaing Region","note":"hard-rock gold mine"},{"place":" Irrawaddy & Chindwin rivers","region":"multiple","note":"alluvial panning"},{"place":"Phakant/Kachin hills","region":"Kachin State","note":""}],"extraction":"မြစ်ကမ်း ရွှေချ (panning/dredging) နှင့် hard-rock ငြိမ့်ခွဲခြင်း","transport":"ဒေသတွင်း ရွှေဆိုင်များ → မန္တလေး/ရန်ကုန်","notes":"mercury သုံးစွဲမှုကြောင့် ပတ်ဝန်းကျင် စိုးရိမ်စရာ ရှိ"}'::jsonb
  ),
  (
    'Tin (Cassiterite)', 'tin-cassiterite', 'SnO2', 'Oxide', 6.5, 6.99,
    '{"colour":"brown to black","luster":"adamantine","crystal_system":"tetragonal"}'::jsonb,
    array['solder','tin plating','alloys','electronics'],
    'တနင်္သာရီ တိုင်းဒေသကြီးသည် အရှေ့တောင်အာရှ tin belt ၏ အစိတ်အပိုင်းဖြစ်ပြီး ကမ္ဘာ့ သံဖြူ ထုတ်လုပ်မှုတွင် အရေးပါသည်။ Tanintharyi lies on the Southeast Asian tin belt; Myanmar is a significant world tin producer.',
    'https://en.wikipedia.org/wiki/Cassiterite', 'Myanmar tin mining Tanintharyi',
    '{"deposits":[{"place":"Heinda, Hermyingyi","region":"Tanintharyi Region","note":"tin-tungsten"},{"place":"Mawchi","region":"Kayah State","note":"tin-tungsten lodes"}],"extraction":"alluvial gravel washing နှင့် lode mining","transport":"Dawei/Myeik ဆိပ်ကမ်းများ → ပြည်ပ","notes":"tungsten နှင့် တွဲ၍ ထွက်လေ့ရှိ"}'::jsonb
  ),
  (
    'Tungsten (Wolframite)', 'tungsten-wolframite', '(Fe,Mn)WO4', 'Tungstate', 5.0, 7.3,
    '{"colour":"brownish black","luster":"submetallic","crystal_system":"monoclinic"}'::jsonb,
    array['hard tooling','cutting tools','filaments','armour'],
    'Mawchi မိုင်း (Kayah) သည် ကမ္ဘာ့ နာမည်ကြီး tungsten-tin မိုင်းများထဲမှ တစ်ခုဖြစ်သည်။ The Mawchi mine in Kayah State was one of the world''s most famous tungsten-tin mines.',
    'https://en.wikipedia.org/wiki/Wolframite', 'tungsten mining Mawchi Myanmar',
    '{"deposits":[{"place":"Mawchi","region":"Kayah State","note":"world-class W-Sn lodes"},{"place":"Hermyingyi","region":"Tanintharyi Region","note":""}],"extraction":"underground lode mining, gravity concentration","transport":"မိုင်းများမှ ကား → ဆိပ်ကမ်း","notes":"tungsten သည် အမာဆုံး သတ္တုများထဲမှ တစ်ခု (mp ~3422°C)"}'::jsonb
  ),
  (
    'Lead-Zinc-Silver (Galena)', 'galena-bawdwin', 'PbS', 'Sulfide', 2.5, 7.6,
    '{"colour":"lead grey","luster":"metallic","crystal_system":"cubic"}'::jsonb,
    array['batteries','silver source','zinc source','solder'],
    'Bawdwin မိုင်း (ရှမ်းပြည်နယ်) သည် lead-zinc-silver အလွန်ကြွယ်ဝပြီး ~၁၅ ရာစုကတည်းက တူးဖော်ခဲ့သည်။ The Bawdwin mine in Shan State is one of the world''s great polymetallic (Pb-Zn-Ag) deposits, worked since the 15th century.',
    'https://en.wikipedia.org/wiki/Bawdwin_mine', 'Bawdwin mine Namtu Myanmar',
    '{"deposits":[{"place":"Bawdwin / Namtu (နမ့်တူ)","region":"Shan State","note":"polymetallic Pb-Zn-Ag"}],"extraction":"underground mining, smelting at Namtu","transport":"Namtu → Lashio ရထား/ကား","notes":"galena သည် silver ၏ အဓိက ရင်းမြစ်လည်း ဖြစ်"}'::jsonb
  ),
  (
    'Copper', 'copper', 'Cu', 'Native metal / Sulfide', 3.0, 8.96,
    '{"colour":"reddish","luster":"metallic","crystal_system":"cubic"}'::jsonb,
    array['electrical wiring','plumbing','alloys','electronics'],
    'မုံရွာဒေသ (Letpadaung, Sabetaung, Kyisintaung) သည် မြန်မာ့ အကြီးဆုံး ကြေးနီ မိုင်းများဖြစ်သည်။ The Monywa copper mines (Letpadaung and Sabetaung/Kyisintaung) are Myanmar''s largest copper operations.',
    'https://en.wikipedia.org/wiki/Copper', 'Monywa copper mine Myanmar',
    '{"deposits":[{"place":"Letpadaung, Sabetaung, Kyisintaung","region":"Sagaing Region (Monywa)","note":"porphyry/epithermal copper"}],"extraction":"open-pit + heap leaching / SX-EW","transport":"မုံရွာ → မန္တလေး/ရန်ကုန် → ပြည်ပ","notes":"ပတ်ဝန်းကျင်နှင့် လူမှုရေး အငြင်းပွားဖွယ် ရှိခဲ့"}'::jsonb
  ),
  (
    'Nickel', 'nickel', 'Ni', 'Native metal / Laterite', 4.0, 8.9,
    '{"colour":"silvery white","luster":"metallic","crystal_system":"cubic"}'::jsonb,
    array['stainless steel','batteries','alloys','plating'],
    'Tagaung Taung (Sagaing) သည် laterite နီကယ် သိုက်ကြီး ဖြစ်သည်။ Tagaung Taung in Sagaing Region hosts a large lateritic nickel deposit.',
    'https://en.wikipedia.org/wiki/Nickel', 'Tagaung Taung nickel Myanmar',
    '{"deposits":[{"place":"Tagaung Taung (တကောင်းတောင်)","region":"Sagaing Region","note":"lateritic nickel"}],"extraction":"open-pit, ferronickel smelting","transport":"Tagaung → ဧရာဝတီမြစ်ကြောင်း/ကား","notes":"stainless steel နှင့် EV battery အတွက် အရေးပါလာ"}'::jsonb
  ),
  (
    'Iron Ore (Hematite)', 'iron-hematite', 'Fe2O3', 'Oxide', 6.0, 5.3,
    '{"colour":"steel grey to red","luster":"metallic to earthy","crystal_system":"trigonal"}'::jsonb,
    array['steel making','construction','pigment'],
    'ရှမ်းပြည် Pinpet (ပင်းပက်) တွင် သံရိုင်း သိုက်များ ရှိသည်။ Iron ore deposits occur at Pinpet in Shan State, near Taunggyi.',
    'https://en.wikipedia.org/wiki/Hematite', 'iron ore steel making explained',
    '{"deposits":[{"place":"Pinpet (ပင်းပက်)","region":"Shan State","note":"near Taunggyi"}],"extraction":"open-pit mining","transport":"ပင်းပက် → တောင်ကြီး/ဒေသတွင်း သံထည်","notes":"steel စက်ရုံ စီမံကိန်းများနှင့် ဆက်စပ်"}'::jsonb
  ),
  (
    'Coal (Lignite)', 'coal-lignite', 'C', 'Organic / Sedimentary', 2.0, 1.3,
    '{"colour":"brown to black","luster":"dull","crystal_system":"amorphous"}'::jsonb,
    array['power generation','cement kilns','industrial heat'],
    'ကလေး (Sagaing) နှင့် ရှမ်းပြည်တွင် lignite/subbituminous ကျောက်မီးသွေး သိုက်များ ရှိသည်။ Myanmar has lignite and sub-bituminous coal in Sagaing (Kalewa) and Shan State.',
    'https://en.wikipedia.org/wiki/Lignite', 'how coal is mined and used',
    '{"deposits":[{"place":"Kalewa (ကလေး)","region":"Sagaing Region","note":"lignite"},{"place":"Namma","region":"Shan State","note":""}],"extraction":"open-cast mining","transport":"ကား/မြစ်ကြောင်း → စက်ရုံများ","notes":"လျှပ်စစ်နှင့် ဘိလပ်မြေ စက်ရုံများအတွက်"}'::jsonb
  ),
  (
    'Limestone', 'limestone', 'CaCO3', 'Carbonate', 3.0, 2.7,
    '{"colour":"white to grey","luster":"dull","crystal_system":"trigonal (calcite)"}'::jsonb,
    array['cement','lime','construction','agriculture (soil pH)'],
    'ရှမ်း၊ ကရင်၊ မွန် ဒေသများတွင် ကျောက်တုံးကမ္ဘာ (limestone) ကြွယ်ဝပြီး ဘိလပ်မြေ စက်ရုံများ၏ အဓိက ကုန်ကြမ်း ဖြစ်သည်။ Limestone is abundant across Shan, Kayin and Mon and is the key raw material for Myanmar''s cement industry.',
    'https://en.wikipedia.org/wiki/Limestone', 'limestone cement production',
    '{"deposits":[{"place":"widespread","region":"Shan, Kayin, Mon","note":"karst ranges"}],"extraction":"quarrying (open-pit blasting)","transport":"ကျောက်တွင်း → ဘိလပ်မြေ စက်ရုံ","notes":"စိုက်ပျိုးရေးတွင် မြေဆီလွှာ pH ပြင်ဆင်ရန်လည်း သုံး"}'::jsonb
  ),
  (
    'Gypsum', 'gypsum', 'CaSO4·2H2O', 'Sulfate', 2.0, 2.3,
    '{"colour":"white, colourless","luster":"silky to pearly","crystal_system":"monoclinic"}'::jsonb,
    array['plaster','cement retarder','drywall','fertiliser'],
    'ရှမ်းနှင့် ကယားဒေသတွင် gypsum သိုက်များ ရှိပြီး ဘိလပ်မြေနှင့် ပလာစတာ လုပ်ငန်းများတွင် သုံးသည်။ Gypsum from Shan and Kayah is used in cement and plaster.',
    'https://en.wikipedia.org/wiki/Gypsum', 'gypsum uses plaster cement',
    '{"deposits":[{"place":"Thibaw area","region":"Shan State","note":""},{"place":"Kayah","region":"Kayah State","note":""}],"extraction":"open-pit / underground","transport":"ကား → ဘိလပ်မြေ/ပလာစတာ စက်ရုံ","notes":"စိုက်ပျိုးရေး မြေဩဇာ (S, Ca) အဖြစ်လည်း သုံး"}'::jsonb
  ),
  (
    'Antimony (Stibnite)', 'antimony-stibnite', 'Sb2S3', 'Sulfide', 2.0, 4.6,
    '{"colour":"lead grey","luster":"metallic","crystal_system":"orthorhombic"}'::jsonb,
    array['flame retardants','alloys','batteries','ammunition'],
    'ရှမ်းနှင့် ကယားပြည်နယ်များတွင် stibnite (antimony) သိုက်များ ရှိသည်။ Stibnite, the main antimony ore, occurs in Shan and Kayah States.',
    'https://en.wikipedia.org/wiki/Stibnite', 'antimony stibnite uses',
    '{"deposits":[{"place":"Thabyu/Shan hills","region":"Shan State","note":""},{"place":"Kayah","region":"Kayah State","note":""}],"extraction":"vein/lode mining","transport":"မိုင်း → ကား → ပြည်ပ","notes":"flame-retardant နှင့် alloy တွင် အရေးပါ"}'::jsonb
  ),
  (
    'Barite', 'barite', 'BaSO4', 'Sulfate', 3.25, 4.48,
    '{"colour":"white, grey","luster":"vitreous to pearly","crystal_system":"orthorhombic"}'::jsonb,
    array['drilling mud','paint filler','radiation shielding'],
    'ရှမ်းပြည်တွင် barite သိုက်များ ရှိပြီး ရေနံတွင်း တူးဖော်ရေး drilling mud အတွက် အသုံးဝင်သည်။ Barite from Shan State is used as weighting agent in oil-drilling mud.',
    'https://en.wikipedia.org/wiki/Baryte', 'barite drilling mud uses',
    '{"deposits":[{"place":"Shan hills","region":"Shan State","note":""}],"extraction":"open-pit / vein mining","transport":"မိုင်း → ရေနံလုပ်ငန်း/စက်ရုံ","notes":"သိပ်သည်းဆ မြင့်၍ radiation shielding တွင်လည်း သုံး"}'::jsonb
  ),
  (
    'Quartz', 'quartz', 'SiO2', 'Silicate', 7.0, 2.65,
    '{"colour":"colourless, many","luster":"vitreous","crystal_system":"trigonal"}'::jsonb,
    array['glass','electronics (oscillators)','gemstone','abrasives'],
    'မြန်မာနိုင်ငံ အနှံ့ quartz ပေါများပြီး ဖန်၊ electronics နှင့် ကျောက်မျက်အဖြစ် သုံးသည်။ Quartz is common across Myanmar and used in glass, electronics and as gems (amethyst, citrine).',
    'https://en.wikipedia.org/wiki/Quartz', 'quartz crystal uses electronics',
    '{"deposits":[{"place":"widespread","region":"multiple","note":"pegmatite & vein quartz"}],"extraction":"quarrying / hand-collecting","transport":"ဒေသတွင်း → စက်ရုံ/ဈေးကွက်","notes":"piezoelectric — နာရီနှင့် oscillator များတွင် အသုံးဝင်"}'::jsonb
  )
on conflict (slug) do update set
  symbol = excluded.symbol,
  category = excluded.category,
  hardness_mohs = excluded.hardness_mohs,
  density = excluded.density,
  properties = excluded.properties,
  uses = excluded.uses,
  description = excluded.description,
  wikipedia_url = excluded.wikipedia_url,
  youtube_query = excluded.youtube_query,
  myanmar = excluded.myanmar,
  updated_at = now();
