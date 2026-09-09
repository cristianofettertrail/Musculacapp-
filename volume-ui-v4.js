(() => {
  const FV = window.FetterVolume;
  if (!FV) return;

  const style = document.createElement("style");
  style.textContent = `
    .volume-shell{margin:0 0 12px;border:1px solid rgba(85,229,157,.23);border-radius:18px;background:linear-gradient(180deg,rgba(85,229,157,.055),var(--card));padding:14px;box-shadow:var(--shadow)}
    .volume-shell h3{margin:5px 0 2px;font-size:16px}.volume-shell p{margin:0;color:var(--muted);font-size:10px;line-height:1.45}
    .volume-summary{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:11px}
    .volume-muscle{border:1px solid var(--border);border-radius:12px;background:var(--panel);padding:9px}.volume-muscle strong{display:block;font-size:11px}.volume-muscle span{display:block;color:var(--muted);font-size:9px;margin-top:3px}.volume-muscle b{color:var(--accent);font-size:15px}
    .volume-evolution{margin-top:12px;display:grid;gap:9px}.volume-row{border-top:1px solid var(--border);padding-top:8px}.volume-row:first-child{border-top:0;padding-top:0}.volume-row-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;font-weight:900}.volume-bars{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}.volume-week small{display:flex;justify-content:space-between;color:var(--muted);font-size:8px;margin-bottom:3px}.volume-track{height:8px;border-radius:999px;background:#26313f;overflow:hidden}.volume-fill{height:100%;background:linear-gradient(90deg,var(--accent2),var(--accent));border-radius:999px}
    .volume-extras{margin-top:11px;border-top:1px solid var(--border);padding-top:10px}.extra-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.extra-add{border:1px solid rgba(85,229,157,.35);background:rgba(85,229,157,.07);color:var(--accent);border-radius:10px;padding:8px 10px;font-size:9px;font-weight:900;cursor:pointer}.extra-item{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--border)}.extra-item:first-of-type{border-top:0}.extra-item strong{display:block;font-size:10px}.extra-item span{display:block;color:var(--muted);font-size:9px;margin-top:2px}.extra-del{border:1px solid rgba(255,112,112,.22);background:rgba(255,112,112,.05);color:#ffd6d6;border-radius:9px;padding:7px;font-size:9px;font-weight:900;cursor:pointer}
    .extra-quick{margin:10px 0 0}.extra-quick button{width:100%;min-height:44px;border:1px dashed rgba(85,229,157,.35);border-radius:12px;background:rgba(85,229,157,.04);color:var(--accent);font-weight:900;font-size:10px;cursor:pointer}
    #extraDialog select,#extraDialog input{width:100%;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);padding:11px;font-size:16px;outline:none}#extraDialog .extra-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  `;
  document.head.appendChild(style);

  const fmt = n => {
    const v = Math.round((Number(n)||0)*10)/10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  };

  function ensureDialog(){
    if(document.querySelector("#extraDialog")) return;
    const d=document.createElement("dialog");
    d.id="extraDialog";
    d.innerHTML=`<div class="dialog-body"><h3>Adicionar exercício extra</h3><p>Use quando fizer algo além do treino previsto. Ele entra imediatamente no volume da semana.</p>
      <label class="field"><span>Exercício</span><input id="extraName" type="text" placeholder="Ex.: Crucifixo no cabo"></label>
      <div class="extra-grid"><label class="field"><span>Séries realizadas</span><input id="extraSets" type="number" min="1" max="20" value="3"></label><label class="field"><span>Músculo principal</span><select id="extraPrimary">${FV.muscles.map(m=>`<option>${m}</option>`).join("")}</select></label></div>
      <label class="field"><span>Secundário relevante (opcional)</span><select id="extraSecondary"><option value="">Nenhum</option>${FV.muscles.map(m=>`<option>${m}</option>`).join("")}</select></label>
      <div class="dialog-actions"><button class="dialog-btn primary" id="saveExtra">ADICIONAR AO VOLUME</button><button class="dialog-btn" id="closeExtra">Fechar</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector("#closeExtra").onclick=()=>d.close();
    d.querySelector("#saveExtra").onclick=()=>{
      const name=d.querySelector("#extraName").value.trim();
      const sets=Number(d.querySelector("#extraSets").value);
      const primary=d.querySelector("#extraPrimary").value;
      const secondary=d.querySelector("#extraSecondary").value;
      if(!name || !sets || sets<1) return;
      FV.addExtra({name,sets,primary,secondary});
      d.close();
      d.querySelector("#extraName").value="";
      d.querySelector("#extraSets").value="3";
      renderVolume();
    };
  }

  function ensureQuickButton(){
    const day=document.querySelector("#panel-day");
    if(!day || day.querySelector(".extra-quick")) return;
    const box=document.createElement("div");
    box.className="extra-quick";
    box.innerHTML=`<button type="button">＋ FIZ UM EXERCÍCIO EXTRA</button>`;
    const today=document.querySelector("#todayContainer");
    if(today) today.after(box); else day.appendChild(box);
    box.querySelector("button").onclick=()=>{ensureDialog();document.querySelector("#extraDialog").showModal();};
  }

  function ensureShell(){
    const month=document.querySelector("#panel-month");
    if(!month) return null;
    let shell=month.querySelector("#volumeDashboard");
    if(!shell){shell=document.createElement("section");shell.id="volumeDashboard";shell.className="volume-shell";const mc=document.querySelector("#monthContainer");if(mc)mc.before(shell);else month.appendChild(shell);}return shell;
  }

  function renderVolume(){
    const shell=ensureShell(); if(!shell) return;
    const byWeek=FV.volumesByWeek(); const cw=FV.currentWeek(); const current=byWeek[cw];
    const active=FV.muscles.filter(m=>[1,2,3,4].some(w=>(byWeek[w][m]?.estimated||0)>0));
    const summary=active.length?active.map(m=>`<div class="volume-muscle"><strong>${m}</strong><span><b>${fmt(current[m].estimated)}</b> séries estimadas</span><span>${fmt(current[m].direct)} diretas</span></div>`).join(""):`<div class="empty" style="grid-column:1/-1">Conclua um treino ou adicione um exercício extra para começar a contar.</div>`;
    const globalMax=Math.max(1,...active.flatMap(m=>[1,2,3,4].map(w=>byWeek[w][m]?.estimated||0)));
    const evolution=active.map(m=>`<div class="volume-row"><div class="volume-row-head"><span>${m}</span><span style="color:var(--muted)">diretas / estimadas</span></div><div class="volume-bars">${[1,2,3,4].map(w=>{const v=byWeek[w][m]||{direct:0,estimated:0};const pct=Math.max(0,Math.min(100,(v.estimated/globalMax)*100));return `<div class="volume-week"><small><span>S${w}</span><span>${fmt(v.direct)}/${fmt(v.estimated)}</span></small><div class="volume-track"><div class="volume-fill" style="width:${pct}%"></div></div></div>`}).join("")}</div></div>`).join("");
    const extras=FV.readExtras();
    const extraHtml=extras.length?extras.slice(0,8).map(x=>`<div class="extra-item"><div><strong>${x.name}</strong><span>S${x.week} · ${x.sets} séries · ${x.primary}${x.secondary?` + 0,5× ${x.secondary}`:""}</span></div><button class="extra-del" data-extra-del="${x.id}">EXCLUIR</button></div>`).join(""):`<p style="margin-top:8px">Nenhum exercício extra registrado.</p>`;
    shell.innerHTML=`<div class="eyebrow">Volume de hipertrofia</div><h3>Semana ${cw} · volume realizado</h3><p>Diretas = 1,0 série no músculo principal. Compostos contam 0,5 série estimada para sinergistas relevantes. É uma heurística de acompanhamento, não uma equivalência fisiológica exata.</p><div class="volume-summary">${summary}</div><details style="margin-top:11px"><summary>📈 Ver evolução simples das 4 semanas</summary><div class="volume-evolution">${evolution||`<p>Ainda não há volume realizado.</p>`}</div></details><div class="volume-extras"><div class="extra-head"><div><strong style="font-size:11px">Exercícios a mais</strong><p>Entram imediatamente na contagem geral.</p></div><button class="extra-add" id="addExtraFromVolume">＋ ADICIONAR</button></div><div style="margin-top:7px">${extraHtml}</div></div>`;
    shell.querySelector("#addExtraFromVolume")?.addEventListener("click",()=>{ensureDialog();document.querySelector("#extraDialog").showModal();});
    shell.querySelectorAll("[data-extra-del]").forEach(btn=>btn.addEventListener("click",()=>{FV.removeExtra(btn.dataset.extraDel);renderVolume();}));
  }

  function renderAll(){ ensureDialog(); ensureQuickButton(); renderVolume(); }
  renderAll();
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{if(btn.dataset.tab==="month")setTimeout(renderVolume,0);}));
  const target=document.querySelector("#progressText");
  if(target)new MutationObserver(()=>setTimeout(renderVolume,0)).observe(target,{childList:true,subtree:true,characterData:true});
})();