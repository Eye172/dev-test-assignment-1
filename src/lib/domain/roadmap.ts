import { sectionSchemas } from "./schemas";
import { calculateCompletion, emptySection } from "./completion";
import type { Startup, StrategySection } from "./types";

export type TaskSuggestion = { ruleKey: string; title: string; deliverable: string; rationale: string; week: number };
export type PlanLocale = "en" | "ru" | "kk";
const excerpt = (v: string, length = 140) => v.length > length ? `${v.slice(0, length - 1)}…` : v;
// Stable, deterministic identity lets a channel survive reordering without losing task history.
function channelKey(name: string): string {
  const normalized = name.trim().toLowerCase();
  return `channel:${Array.from(normalized).map(c => c.codePointAt(0)!.toString(16)).join("-")}`;
}
const riskName: Record<PlanLocale, Record<"low" | "medium" | "high", string>> = {
  en: { low: "low", medium: "medium", high: "high" }, ru: { low: "низкий", medium: "средний", high: "высокий" }, kk: { low: "төмен", medium: "орташа", high: "жоғары" },
};

/** Rule copy per language. The rules are identical; only the words change. English is the canonical reference. */
const copy = {
  en: {
    icpTestT: "Interview five people in your target segment", icpPrepT: "Refine your first buyer persona",
    icpTestD: (pain: string) => `Five interview notes testing this recorded pain point: “${pain}”. Record who experiences it, when, and what they use today.`,
    icpPrepD: (segment: string, market: string) => `A specific buyer, pain point and buying trigger for ${segment} in ${market}.`,
    icpTestR: "Your ICP is documented; interviews can now challenge it.", icpPrepR: "Your ICP has missing inputs. A narrower buyer definition makes experiments useful.",
    valTestT: "Test your value proposition with customers", valPrepT: "Write a testable value proposition",
    valTestD: (outcome: string) => `Share the promise “${outcome}” with five target customers. Log understanding, objections and buying intent.`,
    valPrepD: "One customer problem, promised outcome, differentiator and explicit supporting proof or assumptions.",
    valTestR: "The recorded promise needs customer evidence, beyond positive opinions.", valPrepR: "Value Proposition is incomplete; clarify what customers should gain.",
    expT: "Set success criteria before your first experiment",
    expD: (exp: string) => `${exp ? `For “${exp}”, specify` : "Specify"} audience, sample size, deadline, a measurable success threshold and a stop/iterate decision rule.`,
    expR: "Predefined success criteria prevent moving the goalposts after results arrive.",
    chSelT: "Choose one channel and launch a small test", chSelD: "One channel, why your buyers use it, and a first experiment with a measurable response or conversion target.",
    chSelR: "No named acquisition channel is saved yet. Start with one focused experiment.",
    chT: (name: string) => `Run your first ${name} experiment`,
    chD: (name: string, reason: string) => `A small ${name} test with audience, outreach/activity count, responses, objections and next action.${reason ? ` Channel hypothesis: ${reason}.` : " Add why this channel should reach your buyer."}`,
    chR: (name: string) => `You selected ${name}. Measure qualified interest and willingness to pay separately.`,
    asTestT: "Test your highest-risk market assumption", asPrepT: "Identify and test three market assumptions",
    asTestD: (statement: string, risk: string, method: string) => `Test “${statement}” (${risk} risk). ${method ? `Method: ${method}.` : "Define a validation method first."} Record evidence and uncertainty.`,
    asPrepD: "Three testable assumptions, each with a risk rating, method and evidence to collect.",
    asTestR: "Risk ratings prioritize the assumption that could most change the commercial plan.", asPrepR: "No testable market assumption is recorded yet.",
    prTestT: "Test willingness to pay for your initial offer", prPrepT: "Define an initial pricing hypothesis",
    prTestD: (price: string, unit: string) => `Present ${price} per ${unit} to target customers. Record price objections and concrete commitments; do not treat interest as payment.`,
    prPrepD: "A pricing model, initial price assumption, payment unit and rationale, followed by a small offer test.",
    prTestR: "Your price is an assumption until target buyers respond to an actual offer.", prPrepR: "Pricing inputs are incomplete; define a clear offer before testing it.",
    evT: "Review the evidence and commercial bottleneck",
    evD: "An evidence summary separating opinions, interest, meetings, letters of intent, deposits, paid pilots and repeat purchases. Name the remaining uncertainty.",
    evR: "Evidence strength matters more than the number of activities completed.",
    decT: "Choose your next commercial move",
    decD: "A founder-written continue/change/stop decision, the evidence behind it, and the next experiment. Update the GTM strategy with what changed.",
    decR: "The founder makes the decision; task completion cannot validate a market assumption automatically.",
  },
  ru: {
    icpTestT: "Проведите интервью с пятью людьми из целевого сегмента", icpPrepT: "Уточните портрет первого покупателя",
    icpTestD: (pain: string) => `Пять заметок по интервью, проверяющих записанную боль: «${pain}». Запишите, кто с ней сталкивается, когда и чем пользуется сейчас.`,
    icpPrepD: (segment: string, market: string) => `Конкретный покупатель, боль и триггер покупки для сегмента «${segment}» на рынке «${market}».`,
    icpTestR: "Профиль клиента описан — теперь интервью могут его оспорить.", icpPrepR: "В профиле клиента есть пробелы. Более узкое определение покупателя делает эксперименты полезными.",
    valTestT: "Проверьте ценностное предложение на клиентах", valPrepT: "Сформулируйте проверяемое ценностное предложение",
    valTestD: (outcome: string) => `Покажите обещание «${outcome}» пяти целевым клиентам. Зафиксируйте понимание, возражения и намерение купить.`,
    valPrepD: "Одна проблема клиента, обещанный результат, отличие и явные доказательства или допущения.",
    valTestR: "Записанному обещанию нужны доказательства от клиентов, а не только позитивные мнения.", valPrepR: "Ценностное предложение не заполнено; уточните, что получит клиент.",
    expT: "Задайте критерии успеха до первого эксперимента",
    expD: (exp: string) => `${exp ? `Для «${exp}» укажите` : "Укажите"} аудиторию, размер выборки, срок, измеримый порог успеха и правило «остановиться/повторить».`,
    expR: "Заранее заданные критерии успеха не дают сдвигать планку после результатов.",
    chSelT: "Выберите один канал и запустите небольшой тест", chSelD: "Один канал, почему ваши покупатели им пользуются, и первый эксперимент с измеримой целью по откликам или конверсии.",
    chSelR: "Ни один канал привлечения пока не сохранён. Начните с одного сфокусированного эксперимента.",
    chT: (name: string) => `Проведите первый эксперимент: ${name}`,
    chD: (name: string, reason: string) => `Небольшой тест канала «${name}»: аудитория, число касаний, отклики, возражения и следующий шаг.${reason ? ` Гипотеза канала: ${reason}.` : " Добавьте, почему этот канал дойдёт до покупателя."}`,
    chR: (name: string) => `Вы выбрали «${name}». Измеряйте квалифицированный интерес и готовность платить отдельно.`,
    asTestT: "Проверьте самую рискованную рыночную гипотезу", asPrepT: "Сформулируйте и проверьте три рыночные гипотезы",
    asTestD: (statement: string, risk: string, method: string) => `Проверьте «${statement}» (риск: ${risk}). ${method ? `Метод: ${method}.` : "Сначала определите способ проверки."} Запишите доказательства и неопределённость.`,
    asPrepD: "Три проверяемые гипотезы, у каждой — оценка риска, метод и доказательства, которые нужно собрать.",
    asTestR: "Оценка риска выдвигает вперёд гипотезу, которая сильнее всего может изменить коммерческий план.", asPrepR: "Проверяемых рыночных гипотез пока нет.",
    prTestT: "Проверьте готовность платить за первое предложение", prPrepT: "Сформулируйте первую ценовую гипотезу",
    prTestD: (price: string, unit: string) => `Предложите целевым клиентам цену ${price} за единицу «${unit}». Запишите возражения по цене и конкретные обязательства; интерес — не оплата.`,
    prPrepD: "Модель монетизации, стартовая цена, единица оплаты и обоснование, затем небольшой тест предложения.",
    prTestR: "Цена остаётся гипотезой, пока целевые покупатели не отреагируют на реальное предложение.", prPrepR: "Данные о цене не заполнены; сформулируйте понятное предложение до проверки.",
    evT: "Разберите доказательства и коммерческое узкое место",
    evD: "Сводка доказательств, разделяющая мнения, интерес, встречи, письма о намерениях, предоплаты, платные пилоты и повторные покупки. Назовите оставшуюся неопределённость.",
    evR: "Сила доказательств важнее числа выполненных действий.",
    decT: "Выберите следующий коммерческий шаг",
    decD: "Решение основателя: продолжить, изменить или остановиться, доказательства за ним и следующий эксперимент. Обновите GTM-стратегию по итогам.",
    decR: "Решение принимает основатель; выполнение задач не подтверждает рыночную гипотезу автоматически.",
  },
  kk: {
    icpTestT: "Мақсатты сегменттен бес адаммен сұхбат өткізіңіз", icpPrepT: "Алғашқы сатып алушы портретін нақтылаңыз",
    icpTestD: (pain: string) => `Жазылған мәселені тексеретін бес сұхбат жазбасы: «${pain}». Онымен кім, қашан бетпе-бет келетінін және қазір немен шешетінін жазыңыз.`,
    icpPrepD: (segment: string, market: string) => `«${market}» нарығындағы «${segment}» сегменті үшін нақты сатып алушы, мәселе және сатып алу триггері.`,
    icpTestR: "Клиент профилі сипатталған — енді сұхбаттар оны сынай алады.", icpPrepR: "Клиент профилінде олқылықтар бар. Тар анықтама эксперименттерді пайдалы етеді.",
    valTestT: "Құндылық ұсынысын клиенттерде тексеріңіз", valPrepT: "Тексерілетін құндылық ұсынысын жазыңыз",
    valTestD: (outcome: string) => `«${outcome}» уәдесін бес мақсатты клиентке көрсетіңіз. Түсінуін, қарсылықтарын және сатып алу ниетін жазыңыз.`,
    valPrepD: "Бір клиент мәселесі, уәде етілген нәтиже, айырмашылық және анық дәлелдер немесе болжамдар.",
    valTestR: "Жазылған уәдеге оң пікірлерден бөлек, клиенттерден дәлел керек.", valPrepR: "Құндылық ұсынысы толтырылмаған; клиент не алатынын нақтылаңыз.",
    expT: "Алғашқы эксперимент алдында табыс критерийлерін белгілеңіз",
    expD: (exp: string) => `${exp ? `«${exp}» үшін` : ""} аудиторияны, іріктеме көлемін, мерзімді, өлшенетін табыс шегін және «тоқтату/қайталау» ережесін көрсетіңіз.`,
    expR: "Алдын ала белгіленген критерийлер нәтижеден кейін межені жылжытуға жол бермейді.",
    chSelT: "Бір арна таңдап, шағын тест жүргізіңіз", chSelD: "Бір арна, сатып алушылар оны неге қолданатыны және өлшенетін мақсаты бар алғашқы эксперимент.",
    chSelR: "Тарту арнасы әлі сақталмаған. Бір нақты эксперименттен бастаңыз.",
    chT: (name: string) => `Алғашқы экспериментті өткізіңіз: ${name}`,
    chD: (name: string, reason: string) => `«${name}» арнасының шағын тесті: аудитория, байланыс саны, жауаптар, қарсылықтар және келесі қадам.${reason ? ` Арна болжамы: ${reason}.` : " Бұл арна сатып алушыға неге жететінін қосыңыз."}`,
    chR: (name: string) => `Сіз «${name}» арнасын таңдадыңыз. Сапалы қызығушылық пен төлеуге дайындықты бөлек өлшеңіз.`,
    asTestT: "Ең тәуекелді нарықтық болжамды тексеріңіз", asPrepT: "Үш нарықтық болжамды анықтап, тексеріңіз",
    asTestD: (statement: string, risk: string, method: string) => `«${statement}» тексеріңіз (тәуекел: ${risk}). ${method ? `Әдіс: ${method}.` : "Алдымен тексеру тәсілін анықтаңыз."} Дәлелдер мен белгісіздікті жазыңыз.`,
    asPrepD: "Үш тексерілетін болжам, әрқайсысында тәуекел бағасы, әдіс және жиналатын дәлелдер.",
    asTestR: "Тәуекел бағасы коммерциялық жоспарды ең қатты өзгерте алатын болжамды алға шығарады.", asPrepR: "Тексерілетін нарықтық болжам әлі жоқ.",
    prTestT: "Алғашқы ұсынысқа төлеуге дайындықты тексеріңіз", prPrepT: "Алғашқы баға болжамын анықтаңыз",
    prTestD: (price: string, unit: string) => `Мақсатты клиенттерге «${unit}» бірлігі үшін ${price} бағасын ұсыныңыз. Баға қарсылықтары мен нақты міндеттемелерді жазыңыз; қызығушылық — төлем емес.`,
    prPrepD: "Монетизация моделі, бастапқы баға, төлем бірлігі және негіздеме, содан кейін шағын ұсыныс тесті.",
    prTestR: "Мақсатты сатып алушылар нақты ұсынысқа жауап бергенше баға болжам болып қалады.", prPrepR: "Баға деректері толтырылмаған; тексерер алдында түсінікті ұсыныс жасаңыз.",
    evT: "Дәлелдер мен коммерциялық тар жерді талдаңыз",
    evD: "Пікірлерді, қызығушылықты, кездесулерді, ниет хаттарын, алдын ала төлемдерді, ақылы пилоттарды және қайта сатып алуды ажырататын дәлелдер жиынтығы. Қалған белгісіздікті атаңыз.",
    evR: "Орындалған әрекеттер санынан гөрі дәлелдің күші маңызды.",
    decT: "Келесі коммерциялық қадамды таңдаңыз",
    decD: "Негізін қалаушының шешімі: жалғастыру, өзгерту немесе тоқтату, оның артындағы дәлелдер және келесі эксперимент. GTM стратегиясын жаңартыңыз.",
    decR: "Шешімді негізін қалаушы қабылдайды; тапсырманы орындау нарықтық болжамды өздігінен растамайды.",
  },
} as const;

export function generateRoadmap(startup: Pick<Startup, "customerSegment" | "targetMarket">, sections: StrategySection[], locale: PlanLocale = "en"): TaskSuggestion[] {
  const c = copy[locale] ?? copy.en;
  const completion = calculateCompletion(sections);
  const complete = (key: string) => completion.sections.find(s => s.key === key)!.complete;
  const get = (key: StrategySection["key"]) => sections.find(s => s.key === key)?.data ?? emptySection(key).data;
  const icp = sectionSchemas.icp.parse(get("icp"));
  const value = sectionSchemas.value.parse(get("value"));
  const pricing = sectionSchemas.pricing.parse(get("pricing"));
  const channels = sectionSchemas.channels.parse(get("channels"));
  const assumptions = sectionSchemas.assumptions.parse(get("assumptions")).assumptions;
  const risky = [...assumptions].filter(a => a.statement).sort((a, b) => ({ low: 0, medium: 1, high: 2 }[b.risk] - { low: 0, medium: 1, high: 2 }[a.risk]))[0];
  const namedChannels = channels.channels.filter(ch => ch.name);
  const distinct = namedChannels.filter((ch, i) => namedChannels.findIndex(x => x.name.toLowerCase() === ch.name.toLowerCase()) === i);
  const tasks: TaskSuggestion[] = [
    { ruleKey: complete("icp") ? "icp-interviews" : "icp-prepare", week: 1,
      title: complete("icp") ? c.icpTestT : c.icpPrepT,
      deliverable: complete("icp") ? c.icpTestD(excerpt(icp.painPoint)) : c.icpPrepD(excerpt(startup.customerSegment), excerpt(startup.targetMarket)),
      rationale: complete("icp") ? c.icpTestR : c.icpPrepR },
    { ruleKey: complete("value") ? "value-customer-test" : "value-prepare", week: 1,
      title: complete("value") ? c.valTestT : c.valPrepT,
      deliverable: complete("value") ? c.valTestD(excerpt(value.outcome)) : c.valPrepD,
      rationale: complete("value") ? c.valTestR : c.valPrepR },
    { ruleKey: "experiment-design", week: 1, title: c.expT,
      deliverable: c.expD(channels.firstExperiment ? excerpt(channels.firstExperiment) : ""),
      rationale: c.expR },
    ...(!distinct.length ? [{ ruleKey: "channel-selection", week: 2, title: c.chSelT, deliverable: c.chSelD, rationale: c.chSelR }] : distinct.map(ch => ({
      ruleKey: channelKey(ch.name), week: 2, title: c.chT(excerpt(ch.name, 90)),
      deliverable: c.chD(excerpt(ch.name, 90), ch.reason ? excerpt(ch.reason) : ""),
      rationale: c.chR(excerpt(ch.name, 90)),
    }))),
    { ruleKey: risky ? "assumption-experiment" : "assumption-prepare", week: 2, title: risky ? c.asTestT : c.asPrepT,
      deliverable: risky ? c.asTestD(excerpt(risky.statement), riskName[locale][risky.risk], risky.validationMethod ? excerpt(risky.validationMethod) : "") : c.asPrepD,
      rationale: risky ? c.asTestR : c.asPrepR },
    { ruleKey: complete("pricing") ? "pricing-offer-test" : "pricing-prepare", week: 3, title: complete("pricing") ? c.prTestT : c.prPrepT,
      deliverable: complete("pricing") ? c.prTestD(excerpt(pricing.initialPrice), excerpt(pricing.paymentUnit)) : c.prPrepD,
      rationale: complete("pricing") ? c.prTestR : c.prPrepR },
    { ruleKey: "evidence-review", week: 4, title: c.evT, deliverable: c.evD, rationale: c.evR },
    { ruleKey: "founder-decision", week: 4, title: c.decT, deliverable: c.decD, rationale: c.decR },
  ];
  return tasks;
}
