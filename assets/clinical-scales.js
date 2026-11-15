/* Clinical scale calculations. All functions are independent of the UI. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClinicalScales = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const valid = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const integer = (value, min, max) => valid(value, min, max) && Number.isInteger(value);
  const complete = (values, keys) => keys.every(key => Object.hasOwn(values, key) && values[key] !== '' && values[key] !== null && values[key] !== undefined);
  const sum = values => values.reduce((a, b) => a + b, 0);

  function gcs(v) {
    if (!complete(v, ['eye', 'verbal', 'motor']) || !integer(v.eye, 1, 4) || !integer(v.verbal, 1, 5) || !integer(v.motor, 1, 6)) return null;
    const total = v.eye + v.verbal + v.motor;
    return { total, maximum: 15, breakdown: [v.eye, v.verbal, v.motor], detail: 'E' + v.eye + ' V' + v.verbal + ' M' + v.motor,
      interpretation: total <= 8 ? 'Тяжёлое нарушение сознания' : total <= 12 ? 'Умеренное нарушение сознания' : 'Лёгкое нарушение или ясное сознание' };
  }

  function news2(v) {
    const keys = ['resp', 'spo2', 'oxygen', 'sbp', 'pulse', 'temp', 'mental', 'scale'];
    if (!complete(v, keys) || !integer(v.resp, 0, 100) || !integer(v.spo2, 0, 100) || !integer(v.sbp, 1, 350) || !integer(v.pulse, 0, 300)
      || !valid(v.temp, 25, 45) || ![0, 1].includes(v.oxygen) || ![0, 3].includes(v.mental) || ![1, 2].includes(v.scale)) return null;
    const resp = v.resp <= 8 || v.resp >= 25 ? 3 : v.resp <= 11 ? 1 : v.resp <= 20 ? 0 : 2;
    let spo2;
    if (v.scale === 1) spo2 = v.spo2 <= 91 ? 3 : v.spo2 <= 93 ? 2 : v.spo2 <= 95 ? 1 : 0;
    else if (v.spo2 <= 83) spo2 = 3;
    else if (v.spo2 <= 85) spo2 = 2;
    else if (v.spo2 <= 87) spo2 = 1;
    else if (v.spo2 <= 92) spo2 = 0;
    else if (!v.oxygen) spo2 = 0;
    else spo2 = v.spo2 <= 94 ? 1 : v.spo2 <= 96 ? 2 : 3;
    const oxygen = v.oxygen ? 2 : 0;
    const sbp = v.sbp <= 90 || v.sbp >= 220 ? 3 : v.sbp <= 100 ? 2 : v.sbp <= 110 ? 1 : 0;
    const pulse = v.pulse <= 40 || v.pulse >= 131 ? 3 : v.pulse <= 50 || v.pulse >= 91 && v.pulse <= 110 ? 1 : v.pulse >= 111 ? 2 : 0;
    const temp = v.temp <= 35 ? 3 : v.temp <= 36 || v.temp > 38 && v.temp <= 39 ? 1 : v.temp > 39 ? 2 : 0;
    const scores = [resp, spo2, oxygen, sbp, pulse, temp, v.mental];
    const total = sum(scores);
    const risk = total >= 7 ? 'Высокий риск — экстренная оценка, непрерывный мониторинг'
      : total >= 5 ? 'Средний риск — срочная клиническая оценка'
      : scores.includes(3) ? 'Один параметр = 3 балла — необходима эскалация оценки'
      : total > 0 ? 'Низкий суммарный риск — регулярный мониторинг' : '0 баллов — стандартный мониторинг';
    return { total, maximum: 20, breakdown: scores, interpretation: risk, singleThree: scores.includes(3) };
  }

  function sofa(v) {
    const keys = ['pao2', 'fio2', 'support', 'platelets', 'bilirubin', 'cardio', 'gcs', 'creatinine'];
    if (!complete(v, keys) || !valid(v.pao2, 1, 800) || !valid(v.fio2, 21, 100) || ![0, 1].includes(v.support)
      || !valid(v.platelets, 0, 1500) || !valid(v.bilirubin, 0, 2000) || !integer(v.cardio, 0, 4)
      || !integer(v.gcs, 3, 15) || !valid(v.creatinine, 0, 2500)
      || v.urine !== undefined && v.urine !== '' && !valid(v.urine, 0, 10000)) return null;
    const ratio = v.pao2 / (v.fio2 / 100);
    const respiratory = v.support && ratio < 100 ? 4 : v.support && ratio < 200 ? 3 : ratio < 300 ? 2 : ratio < 400 ? 1 : 0;
    const platelets = v.platelets < 20 ? 4 : v.platelets < 50 ? 3 : v.platelets < 100 ? 2 : v.platelets < 150 ? 1 : 0;
    const bilirubin = v.bilirubin >= 204 ? 4 : v.bilirubin >= 102 ? 3 : v.bilirubin >= 33 ? 2 : v.bilirubin >= 20 ? 1 : 0;
    const neurology = v.gcs < 6 ? 4 : v.gcs <= 9 ? 3 : v.gcs <= 12 ? 2 : v.gcs <= 14 ? 1 : 0;
    const renalCreat = v.creatinine > 440 ? 4 : v.creatinine >= 300 ? 3 : v.creatinine >= 171 ? 2 : v.creatinine >= 110 ? 1 : 0;
    const renalUrine = v.urine === undefined || v.urine === '' ? 0 : v.urine < 200 ? 4 : v.urine < 500 ? 3 : 0;
    const scores = [respiratory, platelets, bilirubin, v.cardio, neurology, Math.max(renalCreat, renalUrine)];
    return { total: sum(scores), maximum: 24, breakdown: scores, detail: 'PaO₂/FiO₂: ' + ratio.toFixed(1) + ' мм рт. ст.',
      interpretation: 'SOFA отражает выраженность органной дисфункции; оценивать в динамике и с учётом клинического контекста.' };
  }

  function egri(v) {
    const keys = ['history', 'thyro', 'mallampati', 'neck', 'weight', 'prognathy', 'mouth'];
    if (!complete(v, keys) || !keys.every(k => integer(v[k], 0, ['history','thyro','mallampati','neck','weight'].includes(k) ? 2 : 1))) return null;
    const scores = keys.map(k => v[k]);
    const total = sum(scores);
    return { total, maximum: 12, breakdown: scores,
      interpretation: total >= 7 ? 'Высокий индекс риска трудной интубации'
        : total >= 4 ? 'Повышенный риск трудной интубации' : 'Невысокий индекс риска; трудная интубация не исключена' };
  }

  function rass(v) {
    if (!complete(v, ['score']) || !integer(v.score, -5, 4)) return null;
    const labels = {
      '4':'Выраженная агрессия', '3':'Резко выраженное возбуждение', '2':'Возбуждение', '1':'Беспокойство',
      '0':'Спокоен и бодрствует', '-1':'Лёгкая седация', '-2':'Умеренная седация', '-3':'Глубокая седация',
      '-4':'Очень глубокая седация', '-5':'Отсутствие пробуждения'
    };
    return { total:v.score, maximum:4, breakdown:[v.score], interpretation:labels[String(v.score)] };
  }
  return Object.freeze({ gcs, news2, sofa, egri, rass });
});
