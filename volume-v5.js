(() => {
  "use strict";

  const STATE_KEY = "fetter_hypertrophy_coach_personal_v2";
  const EXTRA_KEY = "fetter_hypertrophy_volume_extras_v2";
  const MUSCLES = ["Peitoral","Costas","Deltoide lateral","Deltoide posterior","Deltoide anterior","Bíceps","Tríceps"];

  const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const fmt = value => {
    const n = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
  };

  function readState(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); }
    catch { return {}; }
  }

  function readExtras(){
    try {
      const data = JSON.parse(localStorage.getItem(EXTRA_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  function writeExtras(data){
    localStorage.setItem(EXTRA_KEY, JSON.stringify(data));
  }

  function parseSets(dose){
    const match = String(dose || "").match(/(\d+(?:[.,]\d+)?)/);
    return match ? Number(match[1].replace(",", ".")) : 0;
  }

  function primaryMuscle(name,target){
    const t = norm(`${name} ${target}`);
    if(t.includes("deltoide lateral") || t.includes("elevacao lateral")) return "Deltoide lateral";
    if(t.includes("deltoide posterior") || t.includes("crucifixo inverso") || t.includes("face pull")) return "Deltoide posterior";
    if(t.includes("deltoide anterior")) return "Deltoide anterior";
    if(t.includes("peitoral") || t.includes("supino") || t.includes("press inclinado") || t.includes("crucifixo")) return "Peitoral";
    if(t.includes("costas") || t.includes("dorsais") || t.includes("remada") || t.includes("puxada") || t.includes("barra fixa")) return "Costas";
    if(t.includes("triceps") || t.includes("pressdown")) return "Tríceps";
    if(t.includes("biceps") || t.includes("rosca") || t.includes("braquial") || t.includes("braquiorradial")) return "Bíceps";
    return MUSCLES.includes(target) ? target : "Costas";
  }

  function secondaryMuscles(name,target){
    const t = norm(`${name} ${target}`);
    let out = [];
    if(t.includes("supino") || t.includes("press inclinado")) out = ["Tríceps","Deltoide anterior"];
    else if(t.includes("remada")) out = ["Bíceps","Deltoide posterior"];
    else if(t.includes("puxada") || t.includes("barra fixa")) out = ["Bíceps"];
    else if(t.includes("crucifixo")) out = ["Deltoide anterior"];
    return out.filter(m => m !== primaryMuscle(name,target));
  }

  function emptyWeek(){
    const result = {};
    MUSCLES.forEach(m => result[m] = {direct:0,estimated:0});
    return result;
  }

  function addVolume(weekData,name,target,sets,secondaryOverride){
    const n = Number(sets) || 0;
    if(n <= 0) return;
    const primary = primaryMuscle(name,target);
    if(!weekData[primary]) weekData[primary] = {direct:0,estimated:0};
    weekData[primary].direct += n;
    weekData[primary].estimated += n;

    const secondaries = secondaryOverride ? [secondaryOverride] : secondaryMuscles(name,target);
    secondaries.filter(m => MUSCLES.includes(m)).forEach(m => {
      if(!weekData[m]) weekData[m] = {direct:0,estimated:0};
      weekData[m].estimated += n * 0.5;
    });
  }

  function volumesByWeek(){
    const state = readState();
    const completed = state.completed || {};
    const result = {1:emptyWeek(),2:emptyWeek(),3:emptyWeek(),4:emptyWeek()};

    (state.plan || []).forEach(week => {
      const weekNumber = Math.max(1,Math.min(4,Number(week.week) || 1));
      (week.sessions || []).forEach(session => {
        if(!completed[session.id]) return;
        (session.exercises || []).forEach(exercise => {
          addVolume(result[weekNumber],exercise.name,exercise.target,parseSets(exercise.dose),"");
        });
      });
    });

    readExtras().forEach(extra => {
      const weekNumber = Math.max(1,Math.min(4,Number(extra.week) || 1));
      addVolume(result[weekNumber],extra.name,extra.primary,extra.sets,extra.secondary || "");
    });

    return result;
  }

  function currentWeek(){
    const state = readState();
    const completed = state.completed || {};
    const plan = Array.isArray(state.plan) ? state.plan : [];
    for(const week of plan){
      if((week.sessions || []).some(session => !completed[session.id])) return Number(week.week) || 1;
    }
    return plan.length ? Number(plan[plan.length-1].week) || 4 : 1;
  }

  function hasVolume(week,byWeek){
    const data = byWeek[week];
    return !!data && MUSCLES.some(m => Number(data[m] && data[m].estimated || 0) > 0);
  }

  function displayWeek(){
    const byWeek = volumesByWeek();
    const active = currentWeek();
    if(hasVolume(active,byWeek)) return active;
    for(let w=active-1;w>=1;w--) if(hasVolume(w,byWeek)) return w;
    return active;
  }

  function installStyle(){
    if(document.getElementById("volumeV5Style")) return;
    const style = document.createElement("style");
    style.id = "volumeV5Style";
    style.textContent = `
      .volume-v5{margin:0 0 12px;border:1px solid rgba(85,229,157,.23);border-radius:18px;background:linear-gradient(180deg,rgba(85,229,157,.055),var(--card));padding:14px;box-shadow:var(--shadow)}
      .volume-v5 h3{margin:5px 0 3px;font-size:16px}.volume-v5 p{margin:0;color:var(--muted);font-size:10px;line-height:1.45}
      .v5-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:11px}.v5-muscle{border:1px solid var(--border);border-radius:12px;background:var(--panel);padding:9px}.v5-muscle strong{display:block;font-size:11px}.v5-muscle b{display:block;margin-top:3px;color:var(--accent);font-size:16px}.v5-muscle span{display:block;color:var(--muted);font-size:9px;margin-top:2px}
      .v5-evo{display:grid;gap:9px;margin-top:10px}.v5-row{border-top:1px solid var(--border);padding-top:8px}.v5-row:first-child{border-top:0}.v5-row-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;font-weight:900}.v5-bars{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}.v5-week small{display:flex;justify-content:space-between;color:var(--muted);font-size:8px;margin-bottom:3px}.v5-track{height:8px;background:#26313f;border-radius:999px;overflow:hidden}.v5-fill{height:100%;background:linear-gradient(90deg,var(--accent2),var(--accent));border-radius:999px}
      .v5-extra-zone{margin-top:11px;padding-top:10px;border-top:1px solid var(--border)}.v5-extra-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.v5-add{border:1px solid rgba(85,229,157,.35);background:rgba(85,229,157,.07);color:var(--accent);border-radius:10px;padding:8px 10px;font-size:9px;font-weight:900;cursor:pointer}.v5-extra{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--border)}.v5-extra strong{display:block;font-size:10px}.v5-extra span{display:block;color:var(--muted);font-size:9px;margin-top:2px}.v5-del{border:1px solid rgba(255,112,112,.22);background:rgba(255,112,112,.05);color:#ffd6d6;border-radius:9px;padding:7px;font-size:9px;font-weight:900;cursor:pointer}
      .v5-quick{margin:10px 0 0}.v5-quick button{width:100%;min-height:44px;border:1px dashed rgba(85,229,157,.35);border-radius:12px;background:rgba(85,229,157,.04);color:var(--accent);font-weight:900;font-size:10px;cursor:pointer}
      #volumeExtraDialog select,#volumeExtraDialog input{width:100%;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);padding:11px;font-size:16px;outline:none}#volumeExtraDialog .v5-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog(){
    if(document.getElementById("volumeExtraDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "volumeExtraDialog";
    dialog.innerHTML = `<div class="dialog-body"><h3>Exercício extra</h3><p>Registre apenas o que você fez além do treino previsto. Ele entra na contagem geral imediatamente.</p>
      <label class="field"><span>Exercício</span><input id="v5ExtraName" type="text" placeholder="Ex.: Crucifixo no cabo"></label>
      <div class="v5-form-grid"><label class="field"><span>Séries</span><input id="v5ExtraSets" type="number" min="1" max="30" value="3"></label><label class="field"><span>Semana</span><select id="v5ExtraWeek">${[1,2,3,4].map(w=>`<option value="${w}">Semana ${w}</option>`).join("")}</select></label></div>
      <label class="field"><span>Músculo principal</span><select id="v5ExtraPrimary">${MUSCLES.map(m=>`<option>${m}</option>`).join("")}</select></label>
      <label class="field"><span>Secundário relevante (opcional)</span><select id="v5ExtraSecondary"><option value="">Nenhum</option>${MUSCLES.map(m=>`<option>${m}</option>`).join("")}</select></label>
      <div class="dialog-actions"><button class="dialog-btn primary" id="v5SaveExtra">ADICIONAR AO VOLUME</button><button class="dialog-btn" id="v5CloseExtra">Fechar</button></div></div>`;
    document.body.appendChild(dialog);

    dialog.querySelector("#v5CloseExtra").addEventListener("click",()=>dialog.close());
    dialog.querySelector("#v5SaveExtra").addEventListener("click",()=>{
      const name = dialog.querySelector("#v5ExtraName").value.trim();
      const sets = Number(dialog.querySelector("#v5ExtraSets").value);
      const week = Number(dialog.querySelector("#v5ExtraWeek").value);
      const primary = dialog.querySelector("#v5ExtraPrimary").value;
      const secondary = dialog.querySelector("#v5ExtraSecondary").value;
      if(!name || sets <= 0 || !MUSCLES.includes(primary)) return;

      const extras = readExtras();
      extras.unshift({id:`extra_${Date.now()}`,timestamp:new Date().toISOString(),name,sets,week,primary,secondary:MUSCLES.includes(secondary)?secondary:""});
      writeExtras(extras);
      dialog.querySelector("#v5ExtraName").value = "";
      dialog.querySelector("#v5ExtraSets").value = "3";
      dialog.close();
      render();
    });
  }

  function openDialog(){
    ensureDialog();
    const dialog = document.getElementById("volumeExtraDialog");
    dialog.querySelector("#v5ExtraWeek").value = String(displayWeek());
    dialog.showModal();
  }

  function ensureQuickButton(){
    const dayPanel = document.getElementById("panel-day");
    if(!dayPanel || dayPanel.querySelector(".v5-quick")) return;
    const box = document.createElement("div");
    box.className = "v5-quick";
    box.innerHTML = `<button type="button">＋ FIZ UM EXERCÍCIO EXTRA</button>`;
    const today = document.getElementById("todayContainer");
    if(today) today.after(box); else dayPanel.appendChild(box);
    box.querySelector("button").addEventListener("click",openDialog);
  }

  function ensureDashboard(){
    const monthPanel = document.getElementById("panel-month");
    if(!monthPanel) return null;
    let dashboard = document.getElementById("volumeDashboardV5");
    if(!dashboard){
      dashboard = document.createElement("section");
      dashboard.id = "volumeDashboardV5";
      dashboard.className = "volume-v5";
      const monthContainer = document.getElementById("monthContainer");
      if(monthContainer) monthContainer.before(dashboard); else monthPanel.appendChild(dashboard);
    }
    return dashboard;
  }

  function render(){
    installStyle();
    ensureDialog();
    ensureQuickButton();
    const dashboard = ensureDashboard();
    if(!dashboard) return;

    const byWeek = volumesByWeek();
    const shownWeek = displayWeek();
    const current = byWeek[shownWeek] || emptyWeek();
    const activeMuscles = MUSCLES.filter(m => [1,2,3,4].some(w => Number(byWeek[w][m].estimated || 0) > 0));

    const cards = activeMuscles.length ? activeMuscles.map(m => `<div class="v5-muscle"><strong>${m}</strong><b>${fmt(current[m].estimated)} séries</b><span>${fmt(current[m].direct)} diretas · estimado total acima</span></div>`).join("") : `<div class="empty" style="grid-column:1/-1">Conclua um treino ou adicione um exercício extra para iniciar a contagem.</div>`;

    const maxValue = Math.max(1,...activeMuscles.flatMap(m => [1,2,3,4].map(w => Number(byWeek[w][m].estimated || 0))));
    const evolution = activeMuscles.map(m => `<div class="v5-row"><div class="v5-row-head"><span>${m}</span><span style="color:var(--muted)">diretas / total</span></div><div class="v5-bars">${[1,2,3,4].map(w=>{const v=byWeek[w][m];const pct=Math.min(100,(Number(v.estimated||0)/maxValue)*100);return `<div class="v5-week"><small><span>S${w}</span><span>${fmt(v.direct)}/${fmt(v.estimated)}</span></small><div class="v5-track"><div class="v5-fill" style="width:${pct}%"></div></div></div>`;}).join("")}</div></div>`).join("");

    const extras = readExtras();
    const extrasHtml = extras.length ? extras.slice(0,12).map(x=>`<div class="v5-extra"><div><strong>${x.name}</strong><span>S${x.week} · ${fmt(x.sets)} séries · ${x.primary}${x.secondary?` + 0,5× ${x.secondary}`:""}</span></div><button class="v5-del" data-v5-delete="${x.id}">EXCLUIR</button></div>`).join("") : `<p style="margin-top:8px">Nenhum exercício extra registrado.</p>`;

    dashboard.innerHTML = `<div class="eyebrow">Volume de hipertrofia</div><h3>Semana ${shownWeek} · volume realizado</h3><p>O app soma automaticamente as séries dos treinos concluídos. Série direta = 1,0 para o músculo principal; em compostos, sinergistas relevantes recebem 0,5 como estimativa prática.</p><div class="v5-grid">${cards}</div><details style="margin-top:11px"><summary>📈 Evolução de volume nas 4 semanas</summary><div class="v5-evo">${evolution || `<p>Ainda não há dados suficientes.</p>`}</div></details><div class="v5-extra-zone"><div class="v5-extra-head"><div><strong style="font-size:11px">Exercícios a mais</strong><p>Somam automaticamente ao volume geral.</p></div><button class="v5-add" id="v5AddFromDashboard">＋ ADICIONAR</button></div><div style="margin-top:7px">${extrasHtml}</div></div>`;

    dashboard.querySelector("#v5AddFromDashboard").addEventListener("click",openDialog);
    dashboard.querySelectorAll("[data-v5-delete]").forEach(button => button.addEventListener("click",()=>{
      writeExtras(readExtras().filter(item => item.id !== button.dataset.v5Delete));
      render();
    }));
  }

  function start(){
    render();
    document.querySelectorAll(".tab").forEach(button => button.addEventListener("click",()=>setTimeout(render,0)));
    const progress = document.getElementById("progressText");
    if(progress) new MutationObserver(()=>setTimeout(render,0)).observe(progress,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();