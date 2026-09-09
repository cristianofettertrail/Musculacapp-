(() => {
  const STATE_KEY = "fetter_hypertrophy_coach_personal_v2";
  const EXTRA_KEY = "fetter_hypertrophy_volume_extras_v1";
  const muscles = [
    "Peitoral",
    "Costas",
    "Deltoide lateral",
    "Deltoide posterior",
    "Deltoide anterior",
    "Bíceps",
    "Tríceps"
  ];

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); }
    catch { return {}; }
  }

  function readExtras() {
    try {
      const data = JSON.parse(localStorage.getItem(EXTRA_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  function saveExtras(data) {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(data));
  }

  function parseSets(dose) {
    const match = String(dose || "").match(/(\d+(?:[.,]\d+)?)/);
    return match ? Number(match[1].replace(",", ".")) : 0;
  }

  function primaryMuscle(name, target) {
    const text = normalize(`${name} ${target}`);
    if (text.includes("deltoide lateral") || text.includes("elevacao lateral")) return "Deltoide lateral";
    if (text.includes("deltoide posterior") || text.includes("crucifixo inverso") || text.includes("face pull")) return "Deltoide posterior";
    if (text.includes("deltoide anterior")) return "Deltoide anterior";
    if (text.includes("peitoral") || text.includes("supino") || text.includes("press inclinado") || text.includes("crucifixo")) return "Peitoral";
    if (text.includes("costas") || text.includes("dorsais") || text.includes("remada") || text.includes("puxada") || text.includes("barra fixa")) return "Costas";
    if (text.includes("triceps") || text.includes("pressdown")) return "Tríceps";
    if (text.includes("biceps") || text.includes("rosca") || text.includes("braquial") || text.includes("braquiorradial")) return "Bíceps";
    return muscles.includes(target) ? target : "Costas";
  }

  function secondaryMuscles(name, target) {
    const text = normalize(`${name} ${target}`);
    let result = [];
    if (text.includes("supino") || text.includes("press inclinado")) result = ["Tríceps", "Deltoide anterior"];
    else if (text.includes("remada")) result = ["Bíceps", "Deltoide posterior"];
    else if (text.includes("puxada") || text.includes("barra fixa")) result = ["Bíceps"];
    else if (text.includes("crucifixo")) result = ["Deltoide anterior"];
    return result.filter(m => m !== primaryMuscle(name, target));
  }

  function emptyWeek() {
    return Object.fromEntries(muscles.map(m => [m, { direct: 0, estimated: 0 }]));
  }

  function addVolume(volume, name, target, sets, secondaryOverride = "") {
    if (!sets || sets <= 0) return;
    const primary = primaryMuscle(name, target);
    volume[primary].direct += sets;
    volume[primary].estimated += sets;
    const secondary = secondaryOverride ? [secondaryOverride] : secondaryMuscles(name, target);
    secondary.filter(Boolean).forEach(m => volume[m].estimated += sets * 0.5);
  }

  function currentWeek() {
    const state = readState();
    const completed = state.completed || {};
    for (const week of state.plan || []) {
      if ((week.sessions || []).some(session => !completed[session.id])) return Number(week.week) || 1;
    }
    return 4;
  }

  function volumesByWeek() {
    const state = readState();
    const completed = state.completed || {};
    const result = { 1: emptyWeek(), 2: emptyWeek(), 3: emptyWeek(), 4: emptyWeek() };

    (state.plan || []).forEach(week => {
      (week.sessions || []).forEach(session => {
        if (!completed[session.id]) return;
        (session.exercises || []).forEach(exercise => {
          addVolume(result[week.week] || result[1], exercise.name, exercise.target, parseSets(exercise.dose));
        });
      });
    });

    readExtras().forEach(extra => {
      const week = Math.max(1, Math.min(4, Number(extra.week) || 1));
      addVolume(result[week], extra.name, extra.primary, Number(extra.sets) || 0, extra.secondary || "");
    });

    return result;
  }

  function addExtra(extra) {
    const data = readExtras();
    data.unshift({
      id: `extra_${Date.now()}`,
      week: currentWeek(),
      timestamp: new Date().toISOString(),
      ...extra
    });
    saveExtras(data);
  }

  function removeExtra(id) {
    saveExtras(readExtras().filter(item => item.id !== id));
  }

  window.FetterVolume = {
    muscles,
    readExtras,
    addExtra,
    removeExtra,
    currentWeek,
    volumesByWeek
  };
})();