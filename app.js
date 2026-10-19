"use strict";
const $ = s => document.querySelector(s);
const MESES = ["Jul","Ago","Set"], TECS = ["Jorge","Diego"];
const pct = (a,b) => b ? 100*a/b : 0;
const sum = (a,f) => a.reduce((s,x) => s+f(x), 0);
const nf = (n,d=0) => n.toLocaleString("es-PE",{minimumFractionDigits:d,maximumFractionDigits:d});
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const charts = {};

/* ---------- Plugins: cifras sobre el gráfico y línea de meta ---------- */
Chart.register({
  id:"vl",
  afterDatasetsDraw(ch){
    const c = ch.ctx, horiz = ch.options.indexAxis === "y";
    c.save(); c.font = "600 11px " + css("--font"); c.fillStyle = css("--ink");
    c.textAlign = horiz ? "left" : "center"; c.textBaseline = horiz ? "middle" : "bottom";
    ch.data.datasets.forEach((d,i) => {
      if (!d.labels || ch.getDatasetMeta(i).hidden) return;
      ch.getDatasetMeta(i).data.forEach((el,j) => {
        const v = d.data[j]; if (v == null) return;
        const t = (d.fmt || String)(v);
        horiz ? c.fillText(t, el.x+5, el.y) : c.fillText(t, el.x, el.y-5);
      });
    });
    c.restore();
  }
},{
  id:"meta",
  afterDatasetsDraw(ch,_,o){
    if (o.value == null) return;
    const a = ch.chartArea, c = ch.ctx, y = ch.scales.y.getPixelForValue(o.value);
    c.save(); c.setLineDash([6,4]); c.strokeStyle = c.fillStyle = css("--grn"); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(a.left,y); c.lineTo(a.right,y); c.stroke(); c.setLineDash([]);
    c.font = "700 11px " + css("--font"); c.textAlign = "right"; c.textBaseline = "bottom";
    c.fillText(o.label, a.right, y-3); c.restore();
  }
});


/* Brillo neon en líneas y barras (solo en modo neon) */
Chart.register({
  id:"glow",
  beforeDatasetDraw(ch,a){
    ch._g = false; if (document.documentElement.dataset.theme !== "dark") return;
    const d = ch.data.datasets[a.index], col = [d.borderColor,d.backgroundColor].find(x=>typeof x==="string");
    if (!col) return;
    ch.ctx.save(); ch.ctx.shadowColor = col; ch.ctx.shadowBlur = 14; ch._g = true;
  },
  afterDatasetDraw(ch){ if (ch._g){ ch.ctx.restore(); ch._g = false; } }
});

function draw(id,type,data,opts={}){
  charts[id]?.destroy();
  Chart.defaults.color = css("--muted"); Chart.defaults.font.family = css("--font"); Chart.defaults.borderColor = css("--line");
  const plugins = Object.assign({legend:{display:data.datasets.length>1,position:"bottom",labels:{boxWidth:10,usePointStyle:true}}}, opts.plugins);
  charts[id] = new Chart($("#"+id),{type,data,options:Object.assign({responsive:true,maintainAspectRatio:false,layout:{padding:{top:18,right:28}}},opts,{plugins})});
}

/* ---------- Tarjetas de KPI (valor, meta y estado) ---------- */
function estado(v,meta,menorEsMejor,tol){
  const ok = menorEsMejor ? v <= meta : v >= meta;
  if (ok) return "ok";
  const dif = menorEsMejor ? v-meta : meta-v;
  return dif <= tol ? "warn" : "bad";
}
function kpis(o,tec,mes){
  const n=o.length, tar=sum(o,x=>x.tardia), det=sum(o,x=>x.det), ing=sum(o,x=>x.total);
  const dias = n ? sum(o,x=>x.dias)/n : 0, tk = n ? ing/n : 0, global = tec==="Todos";
  const meses = mes==="Todos" ? 3 : 1;
  const items = [
    ["Órdenes entregadas",n,"Volumen estable: 60 por mes","neu"],
    ["Entregas tardías",nf(pct(tar,n),1)+" %","Meta ≤ 10 %",estado(pct(tar,n),10,true,5)],
    ["Detenidas por repuesto",nf(pct(det,n),1)+" %","Meta ≤ 3 %",estado(pct(det,n),3,true,3)],
    ["Días promedio de reparación",nf(dias,2),"Meta ≤ 2,2 días",estado(dias,2.2,true,.3)],
    [mes==="Todos"?"Ingresos del periodo":"Ingresos del mes","S/ "+nf(ing),global?"Meta ≥ S/ 8 700 por mes":"La meta es del taller completo",global?estado(ing/meses,8700,false,1000):"neu"],
    ["Ticket promedio","S/ "+nf(tk,2),"Meta ≥ S/ 145",estado(tk,145,false,15)],
    ["Repuestos bajo el mínimo",DATA.stock.length,"Meta: 0",DATA.stock.length?"bad":"ok"]
  ];
  const med = items.filter(i=>i[3]!=="neu"), cum = med.filter(i=>i[3]==="ok").length;
  $("#xp").innerHTML = `<span>Metas cumplidas</span><div class="xpbar"><i style="width:${100*cum/med.length}%"></i></div><b>${cum} de ${med.length}</b>`;
  $("#cards").innerHTML = items.map(([t,v,s,c]) => `<div class="card ${c}"><b>${v}</b><span>${t}</span><small>${s}</small></div>`).join("");
}

/* ---------- Listas de acción: órdenes abiertas y stock ---------- */
function accion(){
  const hoy = new Date(DATA.corte+"T00:00:00");
  $("#sem").innerHTML = DATA.abiertas.map(a => {
    const d = Math.round((new Date(a.fp+"T00:00:00")-hoy)/864e5);
    const c = d<0?"bad":d<=1?"warn":"ok", nom = d<0?"Vencida":d<=1?"Por vencer":"A tiempo";
    return `<li class="${c}"><span class="dot"></span><span>Orden ${a.id}, ${a.estado.toLowerCase()}, ${a.tec}</span><span class="d">${d} d, ${nom}</span></li>`;
  }).join("");
  $("#corte").textContent = "Corte al "+DATA.corte.split("-").reverse().join("/")+". Días = fecha prometida menos fecha de corte.";
  $("#stk").innerHTML = DATA.stock.map(s => `<li><span class="nm">${s.n}</span><span class="bar" title="Stock frente al mínimo"><i style="width:${100*s.act/s.min}%"></i></span><span class="q">${s.act} de ${s.min}</span></li>`).join("");
}

/* ---------- Hallazgos del Capítulo VI ---------- */
const HALLAZGOS = [
  ["Los retrasos crecen cada mes","16,7 % en julio, 20,0 % en agosto y 23,3 % en setiembre."],
  ["La falta de repuesto multiplica el riesgo","80,0 % de tardías entre las detenidas, frente a 14,5 % en el resto."],
  ["Pero no explica todos los retrasos","24 de las 36 entregas tardías (66,7 %) no tuvieron detención."],
  ["El aumento de setiembre se concentra en un técnico","Diego Castillo pasó de 18,8 % a 35,5 % de tardías; Jorge Huamán bajó a 10,3 %."],
  ["Las órdenes ingresadas en lunes se retrasan más","29,4 % de tardías frente a 17,8 % en el resto de días."],
  ["Hay repuestos críticos a punto de agotarse","Cuatro repuestos con una sola unidad; reposición inmediata."],
  ["Hay equipos terminados sin entregar","Órdenes 182 y 183 con 7 y 5 días de atraso: falta avisar al cliente."]
];
const ESC = [["Base, julio a setiembre",36,20.0,"bad"],["A. Sin detenciones por falta de repuesto",24,13.3,"warn"],["B. A, más un técnico alineado al mejor desempeño",16,8.9,"ok"]];
function estaticos(){
  $("#hal").innerHTML = HALLAZGOS.map(([t,e]) => `<li><strong>${t}</strong><small>${e}</small></li>`).join("");
  $("#esc").innerHTML = ESC.map(([t,n,p,c]) => `<div class="esc ${c}"><p><span>${t}</span><span>${n} tardías, ${nf(p,1)} %</span></p><div class="tr"><i style="width:${p*3}%"></i></div></div>`).join("");
}

/* ---------- Render principal ---------- */
function render(){
  const mes = $("#fMes").value, tec = $("#fTec").value;
  const base = DATA.orders.filter(x => tec==="Todos" || x.tec===tec);
  const o = base.filter(x => mes==="Todos" || x.mes===mes);
  const AZ = css("--brand"), RJ = css("--red"), AM = css("--amb"), VD = css("--grn"), CL = css("--soft");
  const f1 = v => nf(v,1)+" %";
  kpis(o,tec,mes);
  const byM = MESES.map(m => base.filter(x => x.mes===m));

  draw("c1","line",{labels:MESES,datasets:[
    {label:"Entregas tardías",data:byM.map(a=>+pct(sum(a,x=>x.tardia),a.length).toFixed(1)),borderColor:RJ,backgroundColor:RJ,tension:.25,labels:true,fmt:f1},
    {label:"Detenidas por repuesto",data:byM.map(a=>+pct(sum(a,x=>x.det),a.length).toFixed(1)),borderColor:AM,backgroundColor:AM,tension:.25,labels:true,fmt:f1}]},
    {scales:{y:{beginAtZero:true,suggestedMax:40}},plugins:{meta:{value:10,label:"Meta 10 %"}}});

  const tecs = TECS.filter(t => tec==="Todos" || t===tec);
  const v2 = tecs.map(t => { const a = DATA.orders.filter(x=>x.tec===t&&(mes==="Todos"||x.mes===mes)); return +pct(a.length-sum(a,x=>x.tardia),a.length).toFixed(1); });
  draw("c2","bar",{labels:tecs,datasets:[{data:v2,backgroundColor:v2.map(v=>v>=90?VD:v>=80?AM:RJ),labels:true,fmt:f1,maxBarThickness:90}]},
    {scales:{y:{beginAtZero:true,max:100}},plugins:{meta:{value:90,label:"Meta 90 %"}}});

  const ing = byM.map(a=>sum(a,x=>x.total));
  draw("c3","bar",{labels:MESES,datasets:[{data:ing,backgroundColor:MESES.map(m=>mes==="Todos"||m===mes?AZ:CL),labels:true,fmt:v=>"S/ "+nf(v),maxBarThickness:90}]},
    {scales:{y:{beginAtZero:true,suggestedMax:11000}},plugins:tec==="Todos"?{meta:{value:8700,label:"Meta S/ 8 700"}}:{}});
  $("#n3").textContent = tec==="Todos" ? "Las barras claras quedan fuera del mes seleccionado." : "Con un técnico seleccionado la meta del taller no se muestra.";

  const sv = {}; o.forEach(x => x.svc.forEach(s => { (sv[s] ??= {n:0,t:0}).n++; sv[s].t += x.tardia; }));
  const nm = Object.keys(sv).sort((a,b)=>sv[b].n-sv[a].n);
  draw("c4","bar",{labels:nm,datasets:[
    {label:"Órdenes",data:nm.map(k=>sv[k].n),backgroundColor:AZ,yAxisID:"y",labels:true},
    {label:"% tardías",type:"line",data:nm.map(k=>+pct(sv[k].t,sv[k].n).toFixed(1)),borderColor:RJ,backgroundColor:RJ,yAxisID:"y1"}]},
    {scales:{y:{beginAtZero:true},y1:{position:"right",beginAtZero:true,max:100,grid:{drawOnChartArea:false}},x:{ticks:{maxRotation:55,font:{size:10}}}}});

  const tardias = o.filter(x=>x.tardia), con = tardias.filter(x=>x.det).length, sin = tardias.length-con;
  draw("c7","doughnut",{labels:[`Con falta de repuesto (${con})`,`Sin falta de repuesto (${sin})`],datasets:[{data:[con,sin],backgroundColor:[AM,RJ],borderWidth:0}]},
    {cutout:"58%",layout:{padding:8},plugins:{legend:{position:"bottom"}}});

  draw("c8","line",{labels:MESES,datasets:TECS.map((t,i)=>({label:t,data:MESES.map(m=>{const a=DATA.orders.filter(x=>x.tec===t&&x.mes===m);return +pct(sum(a,x=>x.tardia),a.length).toFixed(1)}),borderColor:i?RJ:AZ,backgroundColor:i?RJ:AZ,tension:.25,labels:true,fmt:f1}))},
    {scales:{y:{beginAtZero:true,suggestedMax:45}}});

  const lu = o.filter(x=>x.lunes), ot = o.filter(x=>!x.lunes);
  draw("c9","bar",{labels:[`Lunes (${lu.length} órdenes)`,`Otros días (${ot.length})`],datasets:[{data:[+pct(sum(lu,x=>x.tardia),lu.length).toFixed(1),+pct(sum(ot,x=>x.tardia),ot.length).toFixed(1)],backgroundColor:[RJ,AZ],labels:true,fmt:f1,maxBarThickness:90}]},
    {scales:{y:{beginAtZero:true,suggestedMax:45}}});

  const rp = {}; o.forEach(x => Object.entries(x.rep).forEach(([k,q]) => rp[k] = (rp[k]||0)+q));
  const top = Object.entries(rp).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8);
  draw("c5","bar",{labels:top.map(r=>r[0]),datasets:[{data:top.map(r=>r[1]),backgroundColor:AZ,labels:true}]},
    {indexAxis:"y",scales:{y:{ticks:{font:{size:10}}}}});
  $("#c5").closest(".panel").querySelector(".note").textContent = `Repuestos de las ${o.length} órdenes entregadas del filtro (${nf(sum(top,r=>r[1]))} de ${nf(sum(Object.values(rp),q=>q))} unidades usadas).`;

  const MP = ["Efectivo","Yape/Plin","Transferencia","Tarjeta"];
  const pg = DATA.pagos.filter(p => (mes==="Todos"||p.m===mes) && (tec==="Todos"||p.t===tec));
  const pv = MP.map(m => sum(pg.filter(p=>p.mp===m),p=>p.v)), tp = sum(pv,v=>v);
  draw("c10","doughnut",{labels:MP.map((m,i)=>`${m} (${nf(pct(pv[i],tp),1)} %)`),datasets:[{data:pv,backgroundColor:[AZ,VD,AM,CL],borderWidth:0}]},
    {cutout:"58%",layout:{padding:8},plugins:{legend:{position:"bottom"}}});
  $("#c10").closest(".panel").querySelector(".note").textContent = `${sum(pg,p=>p.n)} pagos confirmados, S/ ${nf(tp)}. El mes es el de la fecha de pago.` + (tec==="Todos" ? (mes==="Todos" ? " Incluye 5 pagos de octubre y las ventas de mostrador." : " Incluye ventas de mostrador.") : ` Solo pagos de órdenes de ${tec}; las ventas de mostrador no tienen técnico.`);
}

/* ---------- Eventos y tema ---------- */
function setTheme(t){ document.documentElement.dataset.theme = t; try{localStorage.setItem("fm-theme",t)}catch(e){} }
let saved = null; try{ saved = localStorage.getItem("fm-theme"); }catch(e){}
setTheme(saved || "dark");
$("#theme").addEventListener("click",()=>{ setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"); render(); });
$("#fMes").addEventListener("change",render); $("#fTec").addEventListener("change",render);
$("#reset").addEventListener("click",()=>{ $("#fMes").value="Todos"; $("#fTec").value="Todos"; render(); });
accion(); estaticos(); render();
