import { demoProfile, demoStrategy } from "./demo-content";
import { generateRoadmap, type PlanLocale } from "./roadmap";
import type { Workspace } from "./types";

// Only the supplied synthetic example is translated. Exact per-field matching
// preserves founder edits. This is a display projection, never a database write.
const translations: Record<string, [string, string]> = {
  [demoProfile.description]: ["Рабочее пространство для исследования клиентов: превращает интервью основателя в обоснованные продуктовые и коммерческие решения.", "Клиенттерді зерттеу кеңістігі: негізін қалаушының сұхбаттарын негізделген өнімдік және коммерциялық шешімдерге айналдырады."],
  [demoProfile.targetMarket]: ["Казахстан и Центральная Азия", "Қазақстан және Орталық Азия"],
  [demoProfile.customerSegment]: ["Основатели B2B SaaS-стартапов с командой 2–10 человек", "Командасы 2–10 адамнан тұратын B2B SaaS стартаптарының негізін қалаушылар"],
  [demoProfile.context]: ["Вымышленный демонстрационный стартап. Первая цель — три платных пилотных клиента за 30 дней.", "Ойдан шығарылған демонстрациялық стартап. Алғашқы мақсат — 30 күнде үш ақылы пилоттық клиент."],
  "Harbor pilot — synthetic example": ["Harbor — вымышленный пример", "Harbor — ойдан шығарылған мысал"],
  "A scheduling assistant that helps small logistics teams plan dock slots and avoid truck waiting fees.": ["Помощник по расписанию: помогает небольшим логистическим командам планировать погрузку и сокращать плату за простой грузовиков.", "Шағын логистикалық командаларға тиеу уақытын жоспарлауға және жүк көліктерінің күту ақысын азайтуға көмектесетін кесте көмекшісі."],
  "workspace": ["рабочее пространство", "жұмыс кеңістігі"],
  "Kazakhstan": ["Казахстан", "Қазақстан"],
  "Operations managers at logistics companies with 20–200 employees": ["Операционные менеджеры логистических компаний с 20–200 сотрудниками", "20–200 қызметкері бар логистикалық компаниялардың операциялық менеджерлері"],
  "Synthetic demonstration data. Goal: three paid pilots in 30 days.": ["Вымышленные демонстрационные данные. Цель — три платных пилота за 30 дней.", "Ойдан шығарылған демонстрациялық деректер. Мақсат — 30 күнде үш ақылы пилот."],
  "30-day goal": ["Цель на 30 дней", "30 күндік мақсат"],
  "Three paid pilot customers": ["Три платных пилотных клиента", "Үш ақылы пилоттық клиент"],
  "Team capacity": ["Ресурсы команды", "Команда ресурстары"],
  "Two founders, 6 hours per week for discovery": ["Два основателя, 6 часов в неделю на исследование", "Екі негізін қалаушы, зерттеуге аптасына 6 сағат"],
  [demoStrategy.icp.buyerType]: ["Основатель или продакт-лид небольшого B2B SaaS-стартапа", "Шағын B2B SaaS стартапының негізін қалаушысы немесе өнім жетекшісі"],
  [demoStrategy.icp.industry]: ["SaaS на ранней стадии, команды 2–10 человек", "Ерте кезеңдегі SaaS, 2–10 адамдық командалар"],
  [demoStrategy.icp.painPoint]: ["Данные клиентских интервью разбросаны по заметкам и записям звонков", "Клиент сұхбаттарының деректері жазбалар мен қоңырау жазбаларында шашыраңқы"],
  [demoStrategy.icp.buyingTrigger]: ["Подготовка пилотного предложения или выбор приоритетного сегмента клиентов", "Пилоттық ұсынысты дайындау немесе басым клиент сегментін таңдау"],
  [demoStrategy.value.problem]: ["Основателям сложно связать результаты интервью с коммерческими решениями", "Негізін қалаушыларға сұхбат нәтижелерін коммерциялық шешімдермен байланыстыру қиын"],
  [demoStrategy.value.outcome]: ["Понятный клиентский инсайт и следующий шаг после каждого интервью", "Әр сұхбаттан кейін түсінікті клиенттік инсайт және келесі қадам"],
  [demoStrategy.value.differentiation]: ["Прослеживаемая связь между наблюдениями, гипотезами и решениями основателя", "Бақылаулар, гипотезалар және негізін қалаушының шешімдері арасындағы қадағаланатын байланыс"],
  [demoStrategy.value.proof]: ["Гипотеза: основатели заплатят за прослеживаемость решений. Пять неформальных бесед показали интерес; подтверждённых оплат пока нет.", "Гипотеза: негізін қалаушылар шешімдердің қадағалануына ақы төлейді. Бес бейресми әңгіме қызығушылықты көрсетті; расталған төлемдер әзірге жоқ."],
  "Founder outreach": ["Прямые обращения к основателям", "Негізін қалаушыларға тікелей хабарласу"],
  "Direct conversations reach the buyer and reveal objections early": ["Прямые беседы позволяют выйти на покупателя и рано выявить возражения", "Тікелей әңгімелер сатып алушыға жетіп, қарсылықтарды ерте анықтауға мүмкіндік береді"],
  "Incubator partnerships": ["Партнёрства с инкубаторами", "Инкубаторлармен серіктестік"],
  "Cohort leads can introduce teams actively testing their market": ["Руководители программ могут познакомить с командами, которые проверяют свой рынок", "Бағдарлама жетекшілері нарығын тексеріп жатқан командалармен таныстыра алады"],
  [demoStrategy.channels.firstExperiment]: ["Пригласить 20 SaaS-основателей на 20-минутное интервью; цель — пять подходящих бесед", "20 SaaS негізін қалаушысын 20 минуттық сұхбатқа шақыру; мақсат — бес сәйкес әңгіме"],
  [`${demoStrategy.pricing.initialPrice} · ${demoStrategy.pricing.paymentUnit}`]: ["29 USD/месяц; двухнедельный пилот за 15 USD · рабочее пространство стартапа", "29 USD/ай; екі апталық пилот 15 USD · стартаптың жұмыс кеңістігі"],
  [demoStrategy.pricing.model]: ["Ежемесячная подписка с небольшим платным пилотом", "Шағын ақылы пилоты бар айлық жазылым"],
  [demoStrategy.pricing.initialPrice]: ["29 USD/месяц; двухнедельный пилот за 15 USD", "29 USD/ай; екі апталық пилот 15 USD"],
  [demoStrategy.pricing.paymentUnit]: ["рабочее пространство стартапа", "стартаптың жұмыс кеңістігі"],
  [demoStrategy.pricing.rationale]: ["Небольшой первый платёж помогает проверить коммерческую ценность прослеживаемости", "Шағын алғашқы төлем қадағалаудың коммерциялық құндылығын тексеруге көмектеседі"],
  [demoStrategy.assumptions.assumptions[0].statement]: ["Не менее 3 из 10 опрошенных основателей согласятся на платный пилот", "Сұхбатқа қатысқан 10 негізін қалаушының кемінде 3-еуі ақылы пилотқа келіседі"],
  [demoStrategy.assumptions.assumptions[0].validationMethod]: ["После интервью предложить двухнедельный пилот с ясными условиями и зафиксировать обязательства", "Сұхбаттан кейін нақты шарттары бар екі апталық пилот ұсынып, міндеттемелерді тіркеу"],
  [demoStrategy.assumptions.assumptions[1].statement]: ["Основатели смогут записать инсайт интервью менее чем за пять минут", "Негізін қалаушылар сұхбат инсайтын бес минуттан аз уақытта жаза алады"],
  [demoStrategy.assumptions.assumptions[1].validationMethod]: ["Наблюдать за пятью основателями в рабочем процессе и измерить время", "Бес негізін қалаушының жұмыс барысын бақылап, уақытын өлшеу"],
  [demoStrategy.assumptions.assumptions[2].statement]: ["Руководители инкубаторов познакомят минимум с пятью подходящими основателями", "Инкубатор жетекшілері кемінде бес сәйкес негізін қалаушымен таныстырады"],
  [demoStrategy.assumptions.assumptions[2].validationMethod]: ["Запросить знакомства у трёх руководителей программ и записать подходящие рекомендации", "Үш бағдарлама жетекшісінен таныстыруды сұрап, сәйкес ұсыныстарды тіркеу"],
  "Synthetic example. Commercial assumptions have not been validated.": ["Вымышленный пример. Коммерческие гипотезы не проверены.", "Ойдан шығарылған мысал. Коммерциялық гипотезалар тексерілмеген."],
};

export function demoText(value: string, locale: PlanLocale): string {
  for (const [en, pair] of Object.entries(translations)) {
    if (value === en || pair.includes(value)) return locale === "en" ? en : pair[locale === "ru" ? 0 : 1];
  }
  return value;
}
export function translateDemoContent<T>(value: T, locale: PlanLocale): T {
  if (typeof value === "string") return demoText(value, locale) as T;
  if (Array.isArray(value)) return value.map(v => translateDemoContent(v, locale)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [demoText(k, locale), translateDemoContent(v, locale)])) as T;
  return value;
}

// Match the seed at the same field path. A founder writing "workspace" in a
// description is an edit, even though that word is also a generated category.
function seedFields<T>(value: T, seed: unknown, locale: PlanLocale): T {
  if (typeof value === "string" && typeof seed === "string") {
    return (["en","ru","kk"] as const).some(l=>value===demoText(seed,l)) ? demoText(seed,locale) as T : value;
  }
  if (Array.isArray(value) && Array.isArray(seed)) return value.map((v,i)=>seedFields(v,seed[i],locale)) as T;
  if (value && seed && typeof value === "object" && typeof seed === "object") {
    const template=seed as Record<string,unknown>;
    return Object.fromEntries(Object.entries(value).map(([key,v])=>{
      const canonical=demoText(key,"en");
      return canonical in template ? [demoText(canonical,locale),seedFields(v,template[canonical],locale)] : [key,v];
    })) as T;
  }
  return value;
}
function demoView(raw: Workspace, locale: PlanLocale): Workspace {
  return {...raw,startup:seedFields(raw.startup,demoProfile,locale),sections:raw.sections.map(s=>({...s,
    data:seedFields(s.data,demoStrategy[s.key],locale),notes:seedFields(s.notes,"Synthetic example. Commercial assumptions have not been validated.",locale),
  }))};
}

export function localizeWorkspace(raw: Workspace, locale: PlanLocale): Workspace {
  const synthetic = raw.startup.websiteUrl === demoProfile.websiteUrl && ["en", "ru", "kk"].some(l => raw.startup.context === demoText(demoProfile.context, l as PlanLocale));
  const view = synthetic ? demoView(raw, locale) : raw;
  const target = generateRoadmap(view.startup, view.sections, locale);
  // Match the actual saved template, not merely its rule key. An older task with
  // changed inputs, a manual edit, custom work or an AI proposal stays verbatim.
  const plans = (["en", "ru", "kk"] as const).flatMap(l => {
    const savedInputs = generateRoadmap(raw.startup, raw.sections, l);
    // Regenerating in RU/KK may have stored a localized system template with
    // quotations from the original English seed. Recognize that safe form too.
    if (!synthetic) return [savedInputs];
    const source = demoView(raw, l);
    return [savedInputs, generateRoadmap(source.startup, source.sections, l)];
  });
  const candidates = plans.flatMap(plan => plan.map((task,index)=>({task,index})));
  return { ...view, tasks: raw.tasks.map(task => {
    if (task.source !== "generated" || task.edited) return task;
    const match = candidates.find(({ task: c, index }) => plans.some(plan=>plan[index]?.ruleKey === task.ruleKey) && c.title === task.title && c.deliverable === task.deliverable && c.rationale === task.rationale);
    const copy = match && target[match.index];
    return copy ? { ...task, title: copy.title, deliverable: copy.deliverable, rationale: copy.rationale } : task;
  }) };
}

export function localizeDemoValue<T>(raw: Workspace, value: T, locale: PlanLocale): T {
  return raw.startup.websiteUrl === demoProfile.websiteUrl && ["en", "ru", "kk"].some(l => raw.startup.context === demoText(demoProfile.context, l as PlanLocale)) ? translateDemoContent(value, locale) : value;
}
