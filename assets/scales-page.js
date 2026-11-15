(function () {
  'use strict';
  const calc = window.ClinicalScales;
  const tabs = [...document.querySelectorAll('[data-scale]')];
  const form = document.getElementById('scale-form');
  const score = document.getElementById('scale-score');
  const denominator = document.getElementById('scale-denominator');
  const interpretation = document.getElementById('scale-interpretation');
  const detail = document.getElementById('scale-detail');
  const breakdown = document.getElementById('scale-breakdown');
  const title = document.getElementById('scale-title');
  const description = document.getElementById('scale-description');
  const state = {};
  const activeKey = 'med-calc:scales:active:v1';
  const draftKey = name => 'med-calc:scales:' + name + ':v1';
  const opt = (label, value) => ({ label, value });
  const field = (name, label, options, help = '') => ({ name, label, options, help });
  const num = (name, label, min, max, step = 'any', help = '') => ({ name, label, min, max, step, help });
  const yesNo = [opt('Нет', 0), opt('Да', 1)];
  const gcsEyes = field('eye', 'Открывание глаз', [
    opt('Спонтанно', 4), opt('На обращение', 3), opt('На болевой стимул', 2), opt('Не открывает', 1)
  ]);
  const gcsMotor = field('motor', 'Двигательная реакция', [
    opt('Выполняет команды', 6), opt('Локализует болевой стимул', 5), opt('Отдёргивает на боль', 4),
    opt('Патологическое сгибание', 3), opt('Разгибание', 2), opt('Реакция отсутствует', 1)
  ]);
  const gcsAdults = field('verbal', 'Речевая реакция', [
    opt('Ориентирован', 5), opt('Спутанная речь', 4), opt('Отдельные неподходящие слова', 3),
    opt('Нечленораздельные звуки', 2), opt('Реакция отсутствует', 1)
  ]);
  const gcsChildren = field('verbal', 'Речевая / социальная реакция', [
    opt('Улыбается, следит, взаимодействует', 5), opt('Плачет, но успокаивается', 4),
    opt('Стонет, успокаивается ненадолго', 3), opt('Плачет, не успокаивается', 2),
    opt('Нет речевой или эмоциональной реакции', 1)
  ]);
  const definitions = {
    gcs: { title:'Шкала комы Глазго (GCS)', description:'Глазная, речевая и двигательная реакции. Для интубированных пациентов невозможные для оценки компоненты следует обозначать как NT — не подменять их минимальными баллами.',
      fields: () => [field('ageType','Вариант шкалы',[opt('Взрослые и дети старше 4 лет',0),opt('Дети младше 4 лет',1)]),gcsEyes, state.gcs?.ageType === '1' ? gcsChildren : gcsAdults,gcsMotor],
      names:['Глаза','Речь','Движение'] },
    news2: { title:'NEWS2 — раннее предупреждение', description:'Для взрослых. SpO₂ Scale 2 применяют только по назначению врача при целевой сатурации 88–92 % и риске гиперкапнической дыхательной недостаточности.',
      fields: () => [
        field('scale','Шкала SpO₂',[opt('Scale 1 — стандартная',1),opt('Scale 2 — назначенная врачом',2)]),
        num('resp','Частота дыхания, /мин',0,100,1),num('spo2','SpO₂, %',0,100,1),
        field('oxygen','Дополнительный кислород',yesNo),
        num('sbp','Систолическое АД, мм рт. ст.',1,350,1),
        num('pulse','ЧСС, /мин',0,300,1),
        num('temp','Температура тела, °C',25,45,'any'),
        field('mental','Сознание (ACVPU)',[opt('Alert — бодрствует, нет новой спутанности',0),opt('Новая спутанность / V / P / U',3)])
      ], names:['Дыхание','SpO₂','Кислород','САД','ЧСС','Температура','Сознание'] },
    sofa: { title:'SOFA — оценка органной дисфункции', description:'Шесть органных систем; диапазон 0–24. Значения PaO₂ и FiO₂ вводятся отдельно. При отсутствии оценки компонента нельзя считать общий балл достоверным.',
      fields: () => [
        num('pao2','PaO₂, мм рт. ст.',1,800), num('fio2','FiO₂, %',21,100),
        field('support','Респираторная поддержка',[opt('Нет',0),opt('Да',1)],'Для 3–4 баллов по респираторному компоненту требуется поддержка дыхания.'),
        num('platelets','Тромбоциты, ×10⁹/л',0,1500),num('bilirubin','Общий билирубин, мкмоль/л',0,2000),
        field('cardio','Сердечно-сосудистая система',[
          opt('САД/АДср стабильно: АДср ≥70, без вазопрессоров',0),
          opt('АДср <70 мм рт. ст., без вазопрессоров',1),
          opt('Допамин ≤5 мкг/кг/мин или добутамин (любая доза)',2),
          opt('Допамин >5–15 или адреналин/норадреналин ≤0,1 мкг/кг/мин',3),
          opt('Допамин >15 или адреналин/норадреналин >0,1 мкг/кг/мин',4)
        ],'Вазоактивные препараты: инфузия не менее 1 часа; учитывать наихудший подходящий критерий.'),
        num('gcs','GCS, баллов',3,15,1,'Полная оценка GCS; при невозможности оценить компонент необходима клиническая оговорка.'),
        num('creatinine','Креатинин, мкмоль/л',0,2500),
        num('urine','Диурез за 24 часа, мл (необязательно)',0,10000,1,'При наличии данных почечный балл определяется по худшему из креатинина и диуреза.')
      ], names:['Дыхание','Коагуляция','Печень','Сердечно-сосудистая','ЦНС','Почки'] },
    egri: { title:'Шкала Эль-Ганзури (EGRI)', description:'Семь предикторов трудной интубации. Низкий балл не исключает трудные дыхательные пути.',
      fields: () => [
        field('history','Трудная интубация ранее',[opt('Не было',0),opt('Сведения сомнительны',1),opt('Подтверждена',2)]),
        field('thyro','Щитоподбородочное расстояние',[opt('> 6,5 см',0),opt('6–6,5 см',1),opt('< 6 см',2)]),
        field('mallampati','Mallampati',[opt('Класс I',0),opt('Класс II',1),opt('Класс III–IV',2)]),
        field('neck','Подвижность головы и шеи',[opt('Разгибание > 90°',0),opt('80–90°',1),opt('< 80°',2)]),
        field('weight','Масса тела',[opt('< 90 кг',0),opt('90–110 кг',1),opt('> 110 кг',2)]),
        field('prognathy','Выдвижение нижней челюсти',[opt('Возможно',0),opt('Невозможно',1)]),
        field('mouth','Открывание рта между резцами',[opt('≥ 4 см',0),opt('< 4 см',1)])
      ], names:['Анамнез','Щитоподбородочное','Mallampati','Подвижность шеи','Масса','Нижняя челюсть','Открывание рта'] },
    rass: { title:'RASS — шкала возбуждения и седации', description:'Выберите наиболее подходящий наблюдаемый уровень возбуждения или седации.',
      fields: () => [field('score','Состояние пациента',[
        opt('+4 — агрессивен, непосредственная опасность',4),
        opt('+3 — выраженное возбуждение, удаляет катетеры/трубки',3),
        opt('+2 — частые нецеленаправленные движения, десинхронизация с ИВЛ',2),
        opt('+1 — тревожен, беспокоен без агрессии',1),
        opt('0 — бодрствует, спокоен',0),
        opt('−1 — контакт глазами на голос >10 секунд',-1),
        opt('−2 — контакт глазами на голос <10 секунд',-2),
        opt('−3 — движения или открывание глаз на голос без зрительного контакта',-3),
        opt('−4 — нет реакции на голос, есть реакция на физическую стимуляцию',-4),
        opt('−5 — нет реакции на голос и физическую стимуляцию',-5)
      ])], names:['Уровень RASS'] }
  };

  let current = 'gcs';
  function load(name) {
    if (state[name]) return;
    try {
      const item = JSON.parse(sessionStorage.getItem(draftKey(name)));
      state[name] = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    } catch { state[name] = {}; }
  }
  function persist(name) {
    try { sessionStorage.setItem(draftKey(name), JSON.stringify(state[name])); sessionStorage.setItem(activeKey, name); } catch { /* optional */ }
  }
  function renderForm() {
    const def = definitions[current];
    title.textContent = def.title;
    description.textContent = def.description;
    form.replaceChildren();
    const fields = def.fields();
    for (const f of fields) {
      const group = document.createElement('fieldset');
      group.className = 'scale-field';
      const legend = document.createElement('legend');
      legend.textContent = f.label;
      group.append(legend);
      if (f.options) {
        const items = document.createElement('div');
        items.className = 'scale-options';
        for (const option of f.options) {
          const label = document.createElement('label');
          label.className = 'scale-option';
          const input = document.createElement('input');
          input.type = 'radio'; input.name = f.name; input.value = String(option.value);
          input.checked = state[current][f.name] === input.value;
          const text = document.createElement('span');
          text.textContent = option.label;
          label.append(input, text); items.append(label);
        }
        group.append(items);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'input-group scale-number';
        const input = document.createElement('input');
        input.type = 'number'; input.inputMode = 'decimal'; input.name = f.name; input.min = String(f.min);
        input.max = String(f.max); input.step = String(f.step);
        input.value = typeof state[current][f.name] === 'string' ? state[current][f.name] : '';
        input.setAttribute('aria-label', f.label);
        wrap.append(input); group.append(wrap);
      }
      if (f.help) { const help = document.createElement('p'); help.className = 'field-hint'; help.textContent = f.help; group.append(help); }
      form.append(group);
    }
    updateResult();
  }
  function readState() {
    const values = {};
    for (const f of definitions[current].fields()) {
      const raw = state[current][f.name];
      if (raw === undefined || raw === '') continue;
      const parsed = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(parsed) || f.options && !f.options.some(o => o.value === parsed)
        || !f.options && (parsed < f.min || parsed > f.max || f.step === 1 && !Number.isInteger(parsed))) return null;
      values[f.name] = parsed;
    }
    return values;
  }
  function updateResult() {
    const values = readState();
    const result = values && calc[current](values);
    score.textContent = result ? (result.total > 0 && current === 'rass' ? '+' : '') + String(result.total) : '—';
    denominator.textContent = result ? current === 'rass' ? 'Диапазон от −5 до +4' : 'из ' + result.maximum + ' баллов' : '';
    interpretation.textContent = result ? result.interpretation : 'Выберите значения всех обязательных критериев.';
    interpretation.className = result ? 'scale-meaning' : 'result-empty';
    detail.textContent = result?.detail || '';
    breakdown.replaceChildren();
    if (result && current !== 'rass') {
      result.breakdown.forEach((value, i) => {
        const item = document.createElement('div');
        const label = document.createElement('span');
        label.textContent = definitions[current].names[i];
        const amount = document.createElement('strong');
        amount.textContent = String(value);
        item.append(label, amount);
        breakdown.append(item);
      });
    }
  }
  function select(name, focusTab = false) {
    if (!definitions[name]) return;
    current = name;
    load(current);
    tabs.forEach(tab => {
      const chosen = tab.dataset.scale === name;
      tab.setAttribute('aria-selected', String(chosen));
      tab.tabIndex = chosen ? 0 : -1;
      if (chosen && focusTab) tab.focus();
    });
    document.getElementById('scale-content').setAttribute('aria-labelledby', 'tab-' + name);
    persist(current);
    renderForm();
    history.replaceState(null, '', '#'+name);
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.scale));
    tab.addEventListener('keydown', event => {
      let next = i;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(tabs[next].dataset.scale, true);
    });
  });
  function changed(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.name) return;
    state[current][input.name] = input.value;
    persist(current);
    if (current === 'gcs' && input.name === 'ageType') renderForm();
    else updateResult();
  }
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('submit', event => event.preventDefault());
  document.getElementById('scale-reset').addEventListener('click', () => {
    state[current] = {};
    persist(current);
    renderForm();
  });
  const requested = location.hash.slice(1);
  let initial = 'gcs';
  try { initial = definitions[requested] ? requested : definitions[sessionStorage.getItem(activeKey)] ? sessionStorage.getItem(activeKey) : 'gcs'; } catch { initial = definitions[requested] ? requested : 'gcs'; }
  select(initial);
})();
