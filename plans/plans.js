(() => {
"use strict";
const URL_BASE="https://pvtrlplsplyigvxiykce.supabase.co";
const PUBLIC_KEY="sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";
const db=window.supabase.createClient(URL_BASE,PUBLIC_KEY);
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const state={plans:[],plan:null,selected:null,tool:"select",canWrite:false,snap:true,drag:null,pan:null,view:null,history:[],future:[]};
const catalog={
wall:["Mur","wall",280,22,"#8496a3"],reinforced:["Mur renforcé","wall",280,34,"#b2bbc1"],block:["Mur en parpaings","wall",280,28,"#9a8f80"],partition:["Cloison","wall",220,12,"#778d9e"],glasswall:["Mur vitré","wall",260,16,"#5aa7c9"],fence:["Clôture","wall",260,16,"#b58e55"],mesh:["Grillage","wall",260,12,"#91a6b4"],barrier:["Barrière béton","rect",150,55,"#827e79"],
door:["Porte","opening",100,18,"#58a8d5"],doubleDoor:["Porte double","opening",170,20,"#58a8d5"],armoredDoor:["Porte blindée","opening",120,24,"#bd777c"],gate:["Portail / sas","opening",190,25,"#bd777c"],window:["Fenêtre","opening",110,14,"#65bad2"],securityGlass:["Vitre sécurisée","opening",130,16,"#7bc9db"],porthole:["Hublot","opening",65,16,"#7bc9db"],
stairs:["Escalier","rect",180,130,"#8da7b7"],ladder:["Échelle","rect",55,130,"#8da7b7"],elevator:["Ascenseur","rect",150,150,"#8da7b7"],ramp:["Rampe","rect",190,90,"#8da7b7"],
camera:["Caméra","symbol",48,48,"#66b9e4"],thermal:["Caméra thermique","symbol",48,48,"#b18bce"],reader:["Lecteur badge","symbol",34,48,"#6fa9d0"],alarm:["Alarme","symbol",40,40,"#d17a80"],light:["Éclairage","symbol",55,28,"#d7c27b"],ventilation:["Ventilation","rect",85,85,"#7aa5a2"],panel:["Armoire électrique","rect",65,85,"#b49b73"],terminal:["Terminal","rect",80,55,"#66a9cf"],generator:["Générateur","rect",120,85,"#a58e6c"],extinguisher:["Extincteur","symbol",28,48,"#c86e70"],
desk:["Bureau","rect",110,65,"#9d8d7b"],table:["Table","rect",130,80,"#9d8d7b"],bed:["Lit","rect",90,190,"#8ba3b5"],locker:["Casier","rect",55,75,"#8196a5"],shelf:["Étagère","rect",110,35,"#9d8d7b"],medical:["Équipement médical","rect",100,75,"#6da99d"],decon:["Station de décontamination","rect",150,110,"#5b9a9c"],text:["Annotation","text",180,40,"#b5c5d3"]
};
const notify=(s,bad)=>{const n=$("notice");n.textContent=s;n.classList.toggle("error",!!bad)};
const uid=()=>crypto.randomUUID?crypto.randomUUID():"e"+Date.now()+Math.random().toString(16).slice(2);
const node=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n};
const dims=()=>({w:+state.plan.canvas_width_cm||3000,h:+state.plan.canvas_height_cm||2000});
function remember(){state.history.push(JSON.stringify(state.plan.elements||[]));if(state.history.length>80)state.history.shift();state.future=[]}
function undo(){if(!state.history.length||!state.canWrite)return;state.future.push(JSON.stringify(state.plan.elements));state.plan.elements=JSON.parse(state.history.pop());state.selected=null;draw()}
function redo(){if(!state.future.length||!state.canWrite)return;state.history.push(JSON.stringify(state.plan.elements));state.plan.elements=JSON.parse(state.future.pop());state.selected=null;draw()}
function resetView(){if(!state.plan)return;const d=dims();state.view={x:0,y:0,w:d.w,h:d.h};draw()}
function viewBox(){if(state.view)$("planCanvas").setAttribute("viewBox",[state.view.x,state.view.y,state.view.w,state.view.h].join(" "))}
function zoom(f){if(!state.view)return;const v=state.view,cx=v.x+v.w/2,cy=v.y+v.h/2,w=Math.max(180,Math.min(40000,v.w/f)),h=Math.max(140,Math.min(30000,v.h/f));state.view={x:cx-w/2,y:cy-h/2,w,h};viewBox()}
function snapValue(v){if(!state.snap)return v;const g=Math.max(5,+$("gridSize").value||25);return Math.round(v/g)*g}
function point(ev){const svg=$("planCanvas"),p=svg.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
function wallGeom(w){if(w.x2!==undefined)return {x1:+w.x,y1:+w.y,x2:+w.x2,y2:+w.y2};return {x1:+w.x,y1:+w.y,x2:+w.x+(+w.w||0),y2:+w.y+(+w.h||0)}}
function walls(){return (state.plan.elements||[]).filter(e=>e.type==="wall"&&e.x2!==undefined)}
function covers(a,b,c){return Math.min(a,b)<=c+1&&Math.max(a,b)>=c-1}
function detectRooms(){
 const ws=walls(),xs=[...new Set(ws.filter(w=>Math.abs(w.x2-w.x)<2).map(w=>Math.round(w.x)))].sort((a,b)=>a-b),ys=[...new Set(ws.filter(w=>Math.abs(w.y2-w.y)<2).map(w=>Math.round(w.y)))].sort((a,b)=>a-b),rooms=[],seen=new Set();
 const hasH=(x1,x2,y)=>ws.some(w=>{const g=wallGeom(w);return Math.abs(g.y1-g.y2)<2&&Math.abs(g.y1-y)<2&&covers(g.x1,g.x2,x1)&&covers(g.x1,g.x2,x2)});
 const hasV=(x,y1,y2)=>ws.some(w=>{const g=wallGeom(w);return Math.abs(g.x1-g.x2)<2&&Math.abs(g.x1-x)<2&&covers(g.y1,g.y2,y1)&&covers(g.y1,g.y2,y2)});
 for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)for(let a=0;a<ys.length;a++)for(let b=a+1;b<ys.length;b++){
  const x1=xs[i],x2=xs[j],y1=ys[a],y2=ys[b];if(x2-x1<40||y2-y1<40)continue;
  if(hasH(x1,x2,y1)&&hasH(x1,x2,y2)&&hasV(x1,y1,y2)&&hasV(x2,y1,y2)){
   const key=[x1,y1,x2,y2].join(":");if(!seen.has(key)){seen.add(key);rooms.push({key,x:x1,y:y1,w:x2-x1,h:y2-y1,cx:(x1+x2)/2,cy:(y1+y2)/2})}
  }
 }
 return rooms.filter(r=>!rooms.some(o=>o!==r&&o.x>=r.x&&o.y>=r.y&&o.x+o.w<=r.x+r.w&&o.y+o.h<=r.y+r.h&&(o.w<r.w||o.h<r.h)));
}
function roomName(room){const item=(state.plan.elements||[]).find(e=>e.type==="roomName"&&e.key===room.key);return item?.name||"PIÈCE SANS NOM"}
function attachToWall(e,p){
 const ws=walls();let best=null;
 for(const w of ws){const g=wallGeom(w),dx=g.x2-g.x1,dy=g.y2-g.y1,l2=dx*dx+dy*dy;if(!l2)continue;const t=Math.max(0,Math.min(1,((p.x-g.x1)*dx+(p.y-g.y1)*dy)/l2)),x=g.x1+t*dx,y=g.y1+t*dy,d=Math.hypot(p.x-x,p.y-y);if(!best||d<best.d)best={w,t,x,y,d,angle:Math.atan2(dy,dx)*180/Math.PI}}
 if(best&&best.d<Math.max(90,(+e.h||20)+45)){e.wallId=best.w.id;e.t=best.t;e.x=best.x-(+e.w||100)/2;e.y=best.y-(+e.h||18)/2;e.rotation=best.angle;e.attached=true;return true}
 e.wallId=null;e.attached=false;e.x=p.x-(+e.w||100)/2;e.y=p.y-(+e.h||18)/2;return false
}
function syncOpening(e){if(!e.wallId)return;const w=state.plan.elements.find(x=>x.id===e.wallId);if(!w){e.wallId=null;e.attached=false;return}const g=wallGeom(w),t=Math.max(0,Math.min(1,+e.t||0));e.x=g.x1+t*(g.x2-g.x1)-e.w/2;e.y=g.y1+t*(g.y2-g.y1)-e.h/2;e.rotation=Math.atan2(g.y2-g.y1,g.x2-g.x1)*180/Math.PI}
function shape(e,selected){
 if(e.type==="wall"){
  const g=wallGeom(e),group=node("g",{"data-element-id":e.id,class:"plan-element"+(selected?" selected":"")});
  const style=e.style||"wall",color=({reinforced:"#c0c8ce",block:"#a69a88",partition:"#7d91a0",glasswall:"#69bdd3",fence:"#c4a26d",mesh:"#9eb0bc"})[style]||"#8799a6";
  group.append(node("line",{x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2,stroke:"#08111a","stroke-width":style==="reinforced"?34:style==="block"?29:style==="fence"?21:style==="mesh"?18:style==="glasswall"?23:style==="partition"?19:27,"stroke-linecap":"square","vector-effect":"non-scaling-stroke"}));
  group.append(node("line",{x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2,stroke:color,"stroke-width":style==="reinforced"?24:style==="block"?19:style==="fence"?9:style==="mesh"?7:style==="glasswall"?12:style==="partition"?10:17,"stroke-linecap":"square","vector-effect":"non-scaling-stroke"}));
  if(style==="fence"||style==="mesh"){const length=Math.hypot(g.x2-g.x1,g.y2-g.y1),n=Math.max(1,Math.floor(length/35));for(let i=1;i<n;i++){const t=i/n;group.append(node("line",{x1:g.x1+(g.x2-g.x1)*t,y1:g.y1+(g.y2-g.y1)*t-10,x2:g.x1+(g.x2-g.x1)*t,y2:g.y1+(g.y2-g.y1)*t+10,stroke:color,"stroke-width":3,"vector-effect":"non-scaling-stroke"}))}}
  return group
 }
 const w=Math.max(12,+e.w||60),h=Math.max(12,+e.h||40),g=node("g",{"data-element-id":e.id,class:"plan-element"+(selected?" selected":""),transform:"translate("+e.x+" "+e.y+") rotate("+(+e.rotation||0)+" "+w/2+" "+h/2+")"});
 const rect=(fill,stroke="#71899a",sw=5)=>node("rect",{x:0,y:0,width:w,height:h,rx:2,fill,stroke,"stroke-width":sw});
 if(e.type==="opening"){
  const kind=e.style||"door",col=kind==="armoredDoor"||kind==="gate"?"#c47c83":"#65b6dc";
  g.append(rect("#0b1722",col,8));
  if(kind==="window"||kind==="securityGlass")g.append(node("line",{x1:4,y1:h/2,x2:w-4,y2:h/2,stroke:col,"stroke-width":5}),node("line",{x1:w/2,y1:3,x2:w/2,y2:h-3,stroke:col,"stroke-width":3}));
  else if(kind==="porthole")g.append(node("circle",{cx:w/2,cy:h/2,r:Math.min(w,h)*.34,fill:"none",stroke:col,"stroke-width":7}));
  else g.append(node("path",{d:"M4 "+(h-4)+" A "+Math.max(w,h)+" "+Math.max(w,h)+" 0 0 1 "+(w-4)+" 4",fill:"none",stroke:col,"stroke-width":4}));
 }else if(e.type==="symbol"){
  const c=e.style==="alarm"?"#d67d83":e.style==="thermal"?"#bd94d4":e.style==="light"?"#d6c27a":"#68b8df";
  g.append(node("circle",{cx:w/2,cy:h/2,r:Math.min(w,h)*.34,fill:"#172b3b",stroke:c,"stroke-width":7}),node("path",{d:"M"+w/2+" "+h/2+" L"+(w*.92)+" "+(h*.12)+" L"+(w*.92)+" "+(h*.88)+" Z",fill:c,"fill-opacity":.3,stroke:c,"stroke-width":3}));
 }else{
  const color=e.color||"#526c7d";g.append(rect(color,"#9cb0bd",6));
  if(e.type==="stairs"||e.style==="stairs"){for(let y=12;y<h;y+=18)g.append(node("line",{x1:6,y1:y,x2:w-6,y2:y,stroke:"#c1d0d8","stroke-width":3}))}
  if(e.type==="text"){const t=node("text",{x:w/2,y:h/2+5,"text-anchor":"middle",fill:"#d9e6ef","font-size":18,"font-weight":"bold"});t.textContent=e.name||"ANNOTATION";g.append(t)}
 }
 if(e.name&&e.type!=="text"&&e.type!=="opening"){const t=node("text",{x:w/2,y:h/2+5,"text-anchor":"middle",fill:"#e5edf3","font-size":Math.min(20,Math.max(10,w/Math.max(5,e.name.length)*1.1)),"pointer-events":"none"});t.textContent=e.name;g.append(t)}
 if(selected)g.append(node("rect",{x:-7,y:-7,width:w+14,height:h+14,fill:"none",stroke:"#e4bd67","stroke-width":3,"stroke-dasharray":"8 6"}));
 return g
}
function draw(){
 if(!state.plan)return;const svg=$("planCanvas"),bg=$("canvasBackground"),d=dims();bg.setAttribute("width",d.w);bg.setAttribute("height",d.h);svg.querySelectorAll("[data-element-id],.room-fill,.room-name").forEach(n=>n.remove());
 const rooms=detectRooms();
 rooms.forEach(r=>{svg.append(node("rect",{x:r.x,y:r.y,width:r.w,height:r.h,class:"room-fill"}));const t=node("text",{x:r.cx,y:r.cy,class:"room-name","data-room-key":r.key});t.textContent=roomName(r);svg.append(t)});
 (state.plan.elements||[]).filter(e=>e.type!=="roomName").forEach(e=>{if(e.type==="opening"&&e.wallId)syncOpening(e);svg.append(shape(e,state.selected===e.id))});
 viewBox();$("canvasTitle").textContent=state.plan.name+" — "+state.plan.level_name;$("elementCount").textContent=(state.plan.elements||[]).filter(e=>e.type!=="roomName").length+" ÉLÉMENT(S) · "+rooms.length+" PIÈCE(S)";inspector()
}
function listPlans(){const target=$("planList");target.innerHTML="";if(!state.plans.length){const p=document.createElement("p");p.className="empty-plans";p.textContent="Aucun plan. Créez votre premier niveau.";target.append(p);return}state.plans.forEach(p=>{const b=document.createElement("button");b.className="plan-item"+(state.plan&&state.plan.id===p.id?" active":"");const strong=document.createElement("strong"),small=document.createElement("small");strong.textContent=p.name;small.textContent=(p.level_name||"Niveau non défini")+(p.is_published?" · PUBLIÉ":" · BROUILLON");b.append(strong,small);b.addEventListener("click",()=>choose(p.id));target.append(b)})}
async function loadPlans(){const r=await db.from("facility_plans").select("*").order("sort_order").order("created_at");if(r.error)throw r.error;state.plans=r.data||[];listPlans();if(state.plans.length)choose(state.plans[0].id);else $("workspace").hidden=false}
function choose(id){state.plan=state.plans.find(p=>p.id===id)||null;state.selected=null;state.history=[];state.future=[];if(!state.plan)return;$("planName").value=state.plan.name||"";$("levelName").value=state.plan.level_name||"";$("publishPlan").textContent=state.plan.is_published?"DÉPUBLIER":"PUBLIER";$("savePlan").disabled=!state.canWrite;$("publishPlan").disabled=!state.canWrite;$("deletePlan").disabled=!state.canWrite;resetView();listPlans()}
async function access(){
 const s=await db.auth.getSession();if(s.error)throw s.error;if(!s.data.session)throw new Error("Connectez-vous à votre compte STAFF.");
 const u=await db.auth.getUser();if(u.error||!u.data.user)throw new Error("Session invalide.");
 const a=await db.rpc("has_staff_module_permission",{p_module_code:"facility_plan",p_action:"access"});if(a.error)throw a.error;if(a.data!==true)throw new Error("Votre compte ne dispose pas de l'autorisation d'accès à l'éditeur.");
 const w=await db.rpc("has_staff_module_permission",{p_module_code:"facility_plan",p_action:"write"});if(w.error)throw w.error;state.canWrite=w.data===true;$("accessBadge").textContent=state.canWrite?"ÉDITION AUTORISÉE":"CONSULTATION STAFF";await loadPlans();$("workspace").hidden=false;
 if(!state.canWrite){$("newPlan").disabled=true;$("savePlan").disabled=true;$("publishPlan").disabled=true;$("deletePlan").disabled=true;document.querySelectorAll(".tool").forEach(b=>b.disabled=true);notify("Accès en consultation STAFF : les plans sont visibles, mais non modifiables.")}else notify("Éditeur prêt. Tracez des murs, puis fermez un contour pour générer automatiquement une pièce.")
}
async function createPlan(){if(!state.canWrite)return;const u=await db.auth.getUser(),obj={name:"Nouveau plan",description:"",level_name:"Niveau 0",sort_order:state.plans.length,is_published:false,canvas_width_cm:3000,canvas_height_cm:2000,snap_tolerance_cm:25,elements:[],created_by:u.data.user.id,updated_by:u.data.user.id};const r=await db.from("facility_plans").insert(obj).select().single();if(r.error)throw r.error;state.plans.push(r.data);choose(r.data.id);notify("Nouveau plan créé.")}
async function save(){if(!state.canWrite||!state.plan)return;const u=await db.auth.getUser();state.plan.name=$("planName").value.trim()||"Plan sans nom";state.plan.level_name=$("levelName").value.trim()||"Niveau non défini";const r=await db.from("facility_plans").update({name:state.plan.name,level_name:state.plan.level_name,elements:state.plan.elements,updated_by:u.data.user.id,updated_at:new Date().toISOString()}).eq("id",state.plan.id).select().single();if(r.error)throw r.error;Object.assign(state.plan,r.data);listPlans();notify("Plan enregistré dans la base de données.")}
async function publish(){if(!state.canWrite||!state.plan)return;const next=!state.plan.is_published,u=await db.auth.getUser();const r=await db.from("facility_plans").update({is_published:next,updated_by:u.data.user.id,updated_at:new Date().toISOString()}).eq("id",state.plan.id);if(r.error)throw r.error;state.plan.is_published=next;$("publishPlan").textContent=next?"DÉPUBLIER":"PUBLIER";listPlans();notify(next?"Plan publié dans l'espace membre.":"Publication retirée.")}
async function deletePlan(){if(!state.canWrite||!state.plan||!confirm("Supprimer définitivement le plan « "+state.plan.name+" » ?"))return;const r=await db.from("facility_plans").delete().eq("id",state.plan.id);if(r.error)throw r.error;state.plans=state.plans.filter(p=>p.id!==state.plan.id);state.plan=null;state.selected=null;listPlans();$("planName").value="";$("levelName").value="";$("canvasTitle").textContent="AUCUN PLAN";$("elementCount").textContent="0 ÉLÉMENT";$("planCanvas").querySelectorAll("[data-element-id],.room-fill,.room-name").forEach(n=>n.remove());$("savePlan").disabled=true;$("publishPlan").disabled=true;$("deletePlan").disabled=true;if(state.plans.length)choose(state.plans[0].id);else $("workspace").hidden=false;notify("Plan supprimé.")}
function inspector(){const e=state.plan&&(state.plan.elements||[]).find(x=>x.id===state.selected);$("emptySelection").hidden=!!e;$("elementProperties").hidden=!e;$("deleteElement").disabled=!e||!state.canWrite;if(!e)return;const vals={elementName:e.name||"",elementType:(catalog[e.style]||[e.type])[0]||e.type,elementX:Math.round(e.x||0),elementY:Math.round(e.y||0),elementW:Math.round(e.w||0),elementH:Math.round(e.h||0),elementRotation:+e.rotation||0};Object.entries(vals).forEach(([k,v])=>$(k).value=v);$("elementName").disabled=!state.canWrite;["elementX","elementY","elementW","elementH","elementRotation"].forEach(k=>$(k).disabled=!state.canWrite)}
function createElement(tool,p){const c=catalog[tool];if(!c)return null;const [name,kind,w,h,color]=c,e={id:uid(),type:kind,style:tool,name,x:snapValue(p.x-w/2),y:snapValue(p.y-h/2),w,h,rotation:0,color};if(kind==="wall"){e.x=p.x;e.y=p.y;e.x2=p.x;e.y2=p.y}return e}
function nearestWall(e,p){return attachToWall(e,p)}
function canvasDown(ev){
 if(!state.plan)return;const p=point(ev),target=ev.target.closest("[data-element-id]"),svg=$("planCanvas");
 if(ev.button===1||(state.tool==="select"&&ev.target.id==="canvasBackground")){state.pan={sx:ev.clientX,sy:ev.clientY,view:{...state.view}};$("canvasViewport").classList.add("panning");svg.setPointerCapture(ev.pointerId);return}
 if(!state.canWrite)return;svg.setPointerCapture(ev.pointerId);
 if(state.tool==="select"){
  if(target){const id=target.dataset.elementId,e=state.plan.elements.find(x=>x.id===id);if(!e)return;state.selected=id;remember();state.drag={kind:"move",id,start:p,origin:{x:e.x,y:e.y,x2:e.x2,y2:e.y2,t:e.t}}}
  else state.selected=null;draw();return
 }
 if(state.tool==="wall"||["reinforced","block","partition","glasswall","fence","mesh"].includes(state.tool)){
  remember();const c=catalog[state.tool],e={id:uid(),type:"wall",style:state.tool,name:c[0],x:snapValue(p.x),y:snapValue(p.y),x2:snapValue(p.x),y2:snapValue(p.y)};state.plan.elements.push(e);state.selected=e.id;state.drag={kind:"wall",id:e.id,start:p};draw();return
 }
 remember();const e=createElement(state.tool,p);if(!e)return;state.plan.elements.push(e);state.selected=e.id;state.drag={kind:e.type==="opening"?"opening":"moveNew",id:e.id,start:p,origin:{x:e.x,y:e.y}};draw()
}
function canvasMove(ev){
 const p=point(ev);$("cursorPosition").textContent="X : "+Math.round(p.x)+" / Y : "+Math.round(p.y);
 if(state.pan){const svg=$("planCanvas"),r=svg.getBoundingClientRect(),v=state.pan.view;state.view={...v,x:v.x-(ev.clientX-state.pan.sx)*v.w/r.width,y:v.y-(ev.clientY-state.pan.sy)*v.h/r.height};viewBox();return}
 if(!state.drag)return;const e=state.plan.elements.find(x=>x.id===state.drag.id);if(!e)return;const d=state.drag;
 if(d.kind==="wall"){const dx=p.x-d.start.x,dy=p.y-d.start.y;if(Math.abs(dx)>=Math.abs(dy)){e.x=snapValue(d.start.x);e.y=snapValue(d.start.y);e.x2=snapValue(p.x);e.y2=e.y}else{e.x=snapValue(d.start.x);e.y=snapValue(d.start.y);e.x2=e.x;e.y2=snapValue(p.y)}}
 else if(d.kind==="opening"){nearestWall(e,p);if(e.wallId)e.t=Math.max(0,Math.min(1,((p.x-wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).x1)*(wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).x2-wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).x1)+(p.y-wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).y1)*(wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).y2-wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).y1))/Math.pow(Math.hypot(wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).x2-wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).x1,wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).y2-wallGeom(state.plan.elements.find(w=>w.id===e.wallId)).y1),2)));syncOpening(e)}
 else if(d.kind==="move"||d.kind==="moveNew"){if(e.type==="wall"){const dx=p.x-d.start.x,dy=p.y-d.start.y;e.x=d.origin.x+dx;e.y=d.origin.y+dy;e.x2=d.origin.x2+dx;e.y2=d.origin.y2+dy}else{e.x=d.origin.x+p.x-d.start.x;e.y=d.origin.y+p.y-d.start.y;if(e.type==="opening"&&e.wallId){const w=state.plan.elements.find(x=>x.id===e.wallId);if(w){const g=wallGeom(w),dx=g.x2-g.x1,dy=g.y2-g.y1;e.t=Math.max(0,Math.min(1,((p.x-g.x1)*dx+(p.y-g.y1)*dy)/(dx*dx+dy*dy)));syncOpening(e)}}}}
 draw()
}
function canvasUp(){if(state.drag){const e=state.plan.elements.find(x=>x.id===state.drag.id);if(e&&e.type==="wall"&&Math.hypot(e.x2-e.x,e.y2-e.y)<20){state.plan.elements=state.plan.elements.filter(x=>x.id!==e.id);state.selected=null}if(e&&e.type==="opening"&&!e.wallId)notify("Ouverture posée sans mur associé : déplacez-la sur un mur pour l'y accrocher.",true);draw()}$("canvasViewport").classList.remove("panning");state.drag=null;state.pan=null}
function editRoom(ev){const target=ev.target.closest("[data-room-key]");if(!target||!state.canWrite)return;const key=target.dataset.roomKey,old=roomName({key}),name=prompt("Nom de cette pièce :",old==="PIÈCE SANS NOM"?"":old);if(name===null)return;remember();let item=state.plan.elements.find(e=>e.type==="roomName"&&e.key===key);if(!item){item={id:uid(),type:"roomName",key,name};state.plan.elements.push(item)}else item.name=name.trim()||"PIÈCE SANS NOM";draw()}
function bindProperty(id,key,convert){$(id).addEventListener("change",()=>{const e=state.plan&&(state.plan.elements||[]).find(x=>x.id===state.selected);if(!e||!state.canWrite)return;remember();e[key]=convert?convert($(id).value):$(id).value;if(e.type==="opening"&&e.wallId)syncOpening(e);draw()})}
function init(){
 $("newPlan").addEventListener("click",()=>createPlan().catch(e=>notify(e.message,true)));$("savePlan").addEventListener("click",()=>save().catch(e=>notify(e.message,true)));$("publishPlan").addEventListener("click",()=>publish().catch(e=>notify(e.message,true)));$("deletePlan").addEventListener("click",()=>deletePlan().catch(e=>notify(e.message,true)));
 document.querySelectorAll(".tool").forEach(b=>b.addEventListener("click",()=>{state.tool=b.dataset.tool;document.querySelectorAll(".tool").forEach(x=>x.classList.toggle("active",x===b))}));
 const svg=$("planCanvas");svg.addEventListener("pointerdown",canvasDown);svg.addEventListener("pointermove",canvasMove);svg.addEventListener("pointerup",canvasUp);svg.addEventListener("pointercancel",canvasUp);svg.addEventListener("dblclick",editRoom);
 $("canvasViewport").addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY<0?1.12:.89)},{passive:false});
 $("canvasViewport").addEventListener("pointerdown",e=>{if(e.button===1){$("canvasViewport").setPointerCapture(e.pointerId)}});
 $("snapEnabled").addEventListener("change",e=>state.snap=e.target.checked);
 $("zoomIn").addEventListener("click",()=>zoom(1.25));$("zoomOut").addEventListener("click",()=>zoom(.8));$("fitView").addEventListener("click",resetView);
 $("undoButton").addEventListener("click",undo);$("redoButton").addEventListener("click",redo);
 $("deleteElement").addEventListener("click",()=>{if(!state.canWrite||!state.selected)return;remember();const e=state.plan.elements.find(x=>x.id===state.selected);state.plan.elements=state.plan.elements.filter(x=>x.id!==state.selected&&!(e&&e.type==="wall"&&x.type==="opening"&&x.wallId===e.id));state.selected=null;draw()});
 bindProperty("elementName","name");bindProperty("elementX","x",Number);bindProperty("elementY","y",Number);bindProperty("elementW","w",Number);bindProperty("elementH","h",Number);bindProperty("elementRotation","rotation",Number);
 document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}if(e.key==="Delete"&&state.selected&&document.activeElement.tagName!=="INPUT")$("deleteElement").click()});
}
document.addEventListener("DOMContentLoaded",async()=>{init();try{await access()}catch(e){console.error("[ZONE-431 PLANS]",e);notify(e.message||"Impossible de charger les plans.",true);$("workspace").hidden=true}});
})();