/* 空洞骑士系列 · 收藏品存档解析与修改器
   支持《空洞骑士》与《空洞骑士：丝之歌》的 user*.dat / 解密 JSON。
   本工具全部在本机浏览器内完成，不会上传任何数据。

   加解密格式依据 bloodorca/hollow（base64.js, functions.js）与
   KayDeeTee/Hollow-Knight-SaveManager 的说明实现。
*/

// ============================================================
// 常量与工具
// ============================================================
const $ = s => document.querySelector(s);
const AES_KEY = new TextEncoder().encode('UKu52ePUBwetZ9wNX88o54dnfKRu0T1l');
const CSHARP_HEADER = [0,1,0,0,0,255,255,255,255,1,0,0,0,0,0,0,0,6,1,0,0,0];
let ECB = null; // 延迟创建（等 aes-js 加载完）

// ---------------- 存档加解密 ----------------
function base64EncodeBytes(bytes){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3){
    const b0 = bytes[i], b1 = bytes[i+1], b2 = bytes[i+2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return new TextEncoder().encode(out);
}
function lengthPrefix(len){
  let l = Math.min(0x7FFFFFFF, len);
  const bytes = [];
  for (let i = 0; i < 4; i++){
    if (l >> 7 !== 0){ bytes.push((l & 0x7F) | 0x80); l >>= 7; }
    else { bytes.push(l & 0x7F); l >>= 7; break; }
  }
  if (l !== 0) bytes.push(l);
  return bytes;
}
function encryptBytes(data){
  const pad = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + pad);
  padded.fill(pad); padded.set(data);
  return ECB.encrypt(padded);
}
function decryptBytes(raw){
  let out = ECB.decrypt(raw);
  return out.subarray(0, out.length - out[out.length - 1]);
}
function encryptSave(jsonString){
  return base64EncodeBytes(encryptBytes(new TextEncoder().encode(jsonString)));
}
// 生成 PC 版 .dat。header/trailer 从原始 .dat 保留；若为明文 JSON 则用标准头。
function encodeDat(jsonString, header, trailer){
  const b64 = encryptSave(jsonString);
  const lp = lengthPrefix(b64.length);
  const h = header && header.length ? header : new Uint8Array(CSHARP_HEADER);
  const t = trailer && trailer.length ? trailer : new Uint8Array([11]);
  const out = new Uint8Array(h.length + lp.length + b64.length + t.length);
  out.set(h);
  out.set(lp, h.length);
  out.set(b64, h.length + lp.length);
  out.set(t, h.length + lp.length + b64.length);
  return out;
}
function decodeSave(bytes){
  const header = bytes.slice(0, 22);
  const trailer = bytes.slice(-1);
  let b = bytes.subarray(22, bytes.length - 1);
  let n = 0;
  while (n < 5){ const v = b[n++]; if ((v & 128) === 0) break; }
  b = b.subarray(n);
  const raw = Uint8Array.from(atob(new TextDecoder().decode(b).replace(/\s/g, '')), c => c.charCodeAt(0));
  const json = new TextDecoder().decode(decryptBytes(raw));
  return { json, header, trailer };
}
function download(bytes, filename, mime){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------- 界面状态 ----------------
let state = { save:null, game:null, header:null, trailer:null, isDat:false, filename:'', filter:'all', analysed:[] };

// ============================================================
// 《空洞骑士》收藏数据
// ============================================================
const HK_WIKI={journal:'https://hkss.huijiwiki.com/wiki/%E6%BC%AB%E6%B8%B8%E8%80%85%E6%97%A5%E8%AE%B0',seal:'https://hkss.huijiwiki.com/wiki/%E5%9C%A3%E5%B7%A2%E5%8D%B0%E7%AB%A0',idol:'https://hkss.huijiwiki.com/wiki/%E5%9B%BD%E7%8E%8B%E7%A5%9E%E5%83%8F',egg:'https://hkss.huijiwiki.com/wiki/%E7%A5%9E%E7%A7%98%E8%9B%8B',mask:'https://hkss.huijiwiki.com/wiki/%E9%9D%A2%E5%85%B7%E7%A2%8E%E7%89%87',vessel:'https://hkss.huijiwiki.com/wiki/%E5%AE%B9%E5%99%A8%E7%A2%8E%E7%89%87',ore:'https://hkss.huijiwiki.com/wiki/%E8%8B%8D%E7%99%BD%E7%9F%BF%E7%9F%B3'};
const HK_ICONS={journal:'wanderers-journal.png',seal:'hallownest-seal.png',idol:'kings-idol.png',egg:'arcane-egg.png',mask:'mask-shard.png',vessel:'vessel-fragment.png',ore:'pale-ore.png'};
const HK_world=(id,scene)=>({type:'world',id,scene});
const HK_player=key=>({type:'player',key});
const HK_item=(name,where,wiki,check)=>({name,where,wiki,check});
const HK_make=(prefix,wiki,rows)=>rows.map((r,i)=>HK_item(`${prefix} #${i+1}`,r[0],wiki,r[3]||HK_world(r[1],r[2])));
const HK_GROUPS=[
 {id:'journal',title:'漫游者日记',kind:'relic',items:HK_make('漫游者日记','Wanderer%27s_Journal',[
  ['苍绿之径：雾之峡谷上方房间','Shiny Item','Fungus1_11'],['苍绿之径：鹿角站右侧','Shiny Item','Fungus1_22'],['真菌荒地：蘑菇巨人下方','Shiny Item','Fungus2_04'],['真菌荒地：螳螂村上方房间','Shiny Item','Fungus2_17'],['泪水之城：城市仓库','Shiny Item','Ruins1_28'],['呼啸悬崖：主露天区域','Shiny Item (1)','Cliffs_01'],['水晶山峰：右侧高层房间','Shiny Item (1)','Mines_20'],['安息之地：地下墓穴','Shiny Item','RestingGrounds_10'],['泪水之城：国王驿站上方','Shiny Item','Ruins2_05'],['古老盆地：断桥','Shiny Item','Abyss_02'],['泪水之城：欢乐之屋电梯','Shiny Item (1)','Ruins_Elevator'],['王国边缘：低语之根区域','Shiny Item','Deepnest_East_07'],['王国边缘：营地长椅','Shiny Item','Deepnest_East_13'],['王国边缘：马科斯左侧','Shiny Item','Deepnest_East_18']])},
 {id:'seal',title:'圣巢印章',kind:'relic',items:HK_make('圣巢印章','Hallownest_Seal',[
  ['遗忘十字路：井内','Shiny Item','Crossroads_01'],['真菌荒地：王后驿站上方威洛房间','Shiny Item','Fungus2_34'],['苍绿之径：酸液桥','Shiny Item','Fungus1_10'],['真菌荒地：王后驿站右侧','Shiny Item','Fungus2_03'],['泪水之城：露天椽架','Shiny Item','Ruins1_03'],['泪水之城：灵魂大师奖励房','Shiny Item','Ruins1_32'],['安息之地：地下墓穴','Shiny Item (1)','RestingGrounds_10'],['泪水之城：国王驿站鹿角站','Shiny Item','Ruins2_08'],['虫爷爷：救出 23 只幼虫','Shiny Item Relic2','Crossroads_38'],['雾之峡谷：右侧高层区域','Shiny Item','Fungus3_26'],['雾之峡谷：生命血茧房','Shiny Item','Fungus3_30'],['王后花园：白色夫人房外','Shiny Item','Fungus3_48'],['真菌荒地：螳螂领主奖励房','Shiny Item','Fungus2_31'],['泪水之城：守望者尖塔四层','Shiny Item','Ruins2_03'],['深邃巢穴：下层地图商人上方','Shiny Item','Deepnest_16'],['深邃巢穴：野兽巢穴（可能错过）','Shiny Item','Deepnest_Spider_Town'],['先知：收集 100 精华','','',HK_player('dreamReward1')]])},
 {id:'idol',title:'国王神像',kind:'relic',items:HK_make('国王神像','King%27s_Idol',[
  ['呼啸悬崖：主露天区域','Shiny Item','Cliffs_01'],['水晶山峰：地图商人房，需帝王之翼','Shiny Item Stand','Mines_30'],['安息之地：灵魂沼地瀑布','Shiny Item','RestingGrounds_08'],['皇家水道：粪虫防御者洞穴','Shiny Item Stand','Waterways_15'],['王国边缘：斗兽场入口下方','Shiny Item','Deepnest_East_08'],['深邃巢穴：左特竞技场左侧','Shiny Item','Deepnest_33'],['虫爷爷：救出 38 只幼虫','Shiny Item Relic3','Crossroads_38'],['王国边缘：苍白潜伏者房间','Shiny Item','GG_Lurker']])},
 {id:'egg',title:'奥术之卵',kind:'relic',items:HK_make('奥术之卵','Arcane_Egg',[
  ['深渊：暗影披风房间','Shiny Item','Abyss_10'],['先知：收集 1200 精华','','',HK_player('dreamReward6')],['深渊：出生地，需国王之魂','Shiny Item','Abyss_15'],['深渊：生命血核心房（可能错过）','Shiny Item (1)','Abyss_08']])},
 {id:'mask',title:'面具碎片',items:[
  HK_item('面具碎片 #1','斯莱：150 吉欧','Mask_Shard',HK_player('slyShellFrag1')),HK_item('面具碎片 #2','斯莱：500 吉欧','Mask_Shard',HK_player('slyShellFrag2')),HK_item('面具碎片 #3','斯莱：800 吉欧 + 店主钥匙','Mask_Shard',HK_player('slyShellFrag3')),HK_item('面具碎片 #4','斯莱：1500 吉欧 + 店主钥匙','Mask_Shard',HK_player('slyShellFrag4')),HK_item('面具碎片 #5','先知：1500 精华','Mask_Shard',HK_player('dreamReward7')),
  ...HK_make('面具碎片','Mask_Shard',[['遗忘十字路：温泉下方','Heart Piece','Crossroads_13'],['遗忘十字路：击败躁郁的毛里克','Heart Piece','Crossroads_09'],['虫爷爷：救出 5 只幼虫','Heart Piece','Crossroads_38'],['德特茅斯：救出布蕾塔后进入她的房间','Heart Piece','Room_Bretta'],['王后驿站：需螳螂爪','Heart Piece','Fungus2_01'],['皇家水道：左上区域向左游','Heart Piece','Waterways_04b'],['苍绿之径：石之庇护所，需光蝇灯笼','Heart Piece','Fungus1_36'],['水晶山峰：击败暴怒守卫','Heart Piece','Mines_32'],['深邃巢穴：从真菌核心前往，需帝王之翼','Heart Piece','Fungus2_25'],['蜂巢：引蜂巢守卫撞破墙壁','Heart Piece','Hive_04'],['安息之地：完成送花任务','Heart Piece','Room_Mansion']]).map((x,i)=>({...x,name:`面具碎片 #${i+6}`}))]},
 {id:'vessel',title:'容器碎片',items:[
  HK_item('容器碎片 #1','斯莱：550 吉欧','Vessel_Fragment',HK_player('slyVesselFrag1')),HK_item('容器碎片 #2','斯莱：900 吉欧 + 店主钥匙','Vessel_Fragment',HK_player('slyVesselFrag2')),HK_item('容器碎片 #3','先知：700 精华','Vessel_Fragment',HK_player('dreamReward5')),HK_item('容器碎片 #4','鹿角虫巢','Vessel_Fragment',HK_player('vesselFragStagNest')),
  ...HK_make('容器碎片','Vessel_Fragment',[['苍绿之径：王后花园出口附近','Vessel Fragment','Fungus1_13'],['遗忘十字路：解锁通往泪城的电梯','Vessel Fragment','Crossroads_37'],['泪水之城：国王驿站上方','Vessel Fragment','Ruins2_09'],['深邃巢穴：加皮德平台挑战','Vessel Fragment','Deepnest_38'],['古老盆地喷泉：累计投入 3000 吉欧','Vessel Fragment','Abyss_04']]).map((x,i)=>({...x,name:`容器碎片 #${i+5}`}))]},
 {id:'ore',title:'苍白矿石',items:HK_make('苍白矿石','Pale_Ore',[
  ['古老盆地：电车站左侧','Battle Scene Ore','Abyss_17'],['先知：300 精华','','',HK_player('dreamReward3')],['水晶山峰顶端，需帝王之翼','Shiny Item Stand','Mines_34'],['深邃巢穴：击败诺斯克','Shiny Item Stand','Deepnest_32'],['虫爷爷：救出 31 只幼虫','Shiny Item Ore','Crossroads_38'],['愚人斗兽场：征服者试炼','Shiny Item','Room_Colosseum_Silver']])}
];
function hkActivated(pd, wd, c){
  if (c.type === 'player') return pd[c.key] === true;
  return wd.some(x => x.id === c.id && x.sceneName === c.scene && x.activated === true);
}
function hkRender(save){
  const pd = save.playerData || {}, wd = save.sceneData?.persistentBoolItems || [];
  state.analysed = HK_GROUPS.map(g => ({...g, items:g.items.map(x => ({...x, owned:hkActivated(pd,wd,x.check)}))}));
  const all = state.analysed.flatMap(g=>g.items), own = all.filter(x=>x.owned).length;
  const relics = state.analysed.filter(g=>g.kind==='relic').flatMap(g=>g.items);
  $('#special-label').textContent = '重点收集';
  $('#total').textContent = `${own} / ${all.length}`;
  $('#special').textContent = `${relics.filter(x=>x.owned).length} / ${relics.length}`;
  $('#completion').textContent = pd.completionPercentage != null ? `${pd.completionPercentage}%` : '未知';
  const inv = [['漫游者日记',pd.trinket1],['圣巢印章',pd.trinket2],['国王神像',pd.trinket3],['奥术之卵',pd.trinket4]];
  const invEl = $('#inventory');
  invEl.innerHTML = inv.map(x=>`<div><b>${x[1]??0}</b>${x[0]}</div>`).join('');
  $('#inventory-wrap').hidden = false;
  drawHK();
}
function drawHK(){
  const root = $('#sections'); root.innerHTML = '';
  state.analysed.forEach(g => {
    const shown = g.items.filter(x => state.filter==='all' || (state.filter==='owned' ? x.owned : !x.owned));
    if (!shown.length) return;
    const n = g.items.filter(x=>x.owned).length;
    const sec = document.createElement('section'); sec.className='group';
    sec.innerHTML = `<h2><span><img class="group-icon" src="assets/${HK_ICONS[g.id]}" alt="">${g.title}</span><small>${n} / ${g.items.length}</small></h2><div class="grid">${shown.map(x=>`<article class="item ${x.owned?'owned':''}"><img class="item-icon" src="assets/${HK_ICONS[g.id]}" alt="${g.title}"><span class="status">${x.owned?'✓':'×'}</span><div><b>${x.name}</b><div class="where">${x.where}</div></div><a target="_blank" rel="noreferrer" href="${HK_WIKI[g.id]}">中文维基 ↗</a></article>`).join('')}</div>`;
    root.append(sec);
  });
}

// ============================================================
// 《空洞骑士：丝之歌》收藏数据
// ============================================================
const SS_WIKI='https://hkss.huijiwiki.com/wiki/';
const SS_ICONS={mask:'mask_shard.png',spool:'spool_fragment.png',locket:'mem_locket.png',flea:'flea_icon.png',metal:'craftmetal.png',cylinder:'cylinder.png',heart:'ant_heart.png',berry:'mossberry.webp'};
const SS_world=(scene,id='Collectable Item Pickup')=>({kind:'world',scene,id});
const SS_generic=key=>({kind:'generic',key});
const SS_quest=name=>({kind:'quest',name});
const SS_relic=name=>({kind:'relic',name});
const SS_pretty=s=>s.replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2');
const SS_mk=(title,wiki,id,rows)=>({title,wiki,id,items:rows.map((x,i)=>({name:`${title} #${i+1}`,where:x[0]||SS_pretty(x[1].scene||x[1].key||x[1].name),check:x[1]}))});
const SS_g=keys=>keys.map(k=>['',SS_generic(k)]);
const SS_w=(rows,id)=>rows.map(s=>['',SS_world(s,id)]);
const SS_GROUPS=[
 SS_mk('面具碎片','面具碎片','mask',[
  ['',SS_generic('PurchasedBonebottomHeartPiece')],...SS_w(['Crawl_02','Bone_East_20','Shellwood_14','Dock_08','Weave_05b'],'Heart Piece'),['兽蝇狩猎任务',SS_quest('Beastfly Hunt')],...SS_w(['Song_09','Library_05','Shadow_13'],'Heart Piece'),['遗骨巢穴东部熔岩挑战',SS_world('Bone_East_LavaChallenge','Heart Piece (1)')],...SS_w(['Slab_17','Peak_04c','Wisp_07'],'Heart Piece'),['商人飞地',SS_generic('MerchantEnclaveShellFragment')],...SS_w(['Coral_19b'],'Heart Piece'),['疾跑大师竞速',SS_quest('Sprintmaster Race')],['蚂蚁捕手任务',SS_quest('Ant Trapper')],['摧毁丝线核心',SS_quest('Destroy Thread Cores')],...SS_w(['Peak_06'],'Heart Piece')]),
 SS_mk('灵丝轴碎片','灵丝轴碎片','spool',[
  ...SS_w(['Bone_11b','Bone_East_13','Greymoor_02','Peak_01','Weave_11'],'Silk Spool'),['钟心镇商店',SS_generic('PurchasedBelltownSpoolSegment')],['跳蚤商队：14 只跳蚤',SS_generic('MetCaravanTroupeLeaderGreymoor')],...SS_w(['Cog_07','Library_11b','Song_19_entrance','Under_10','Ward_01'],'Silk Spool'),['营救谢尔玛',SS_quest('Save Sherma')],...SS_w(['Dock_03c','Hang_03_top','Arborium_09'],'Silk Spool'),['格林德尔商店',SS_generic('purchasedGrindleSpoolPiece')],['商人飞地',SS_generic('MerchantEnclaveSpoolPiece')]]),
 SS_mk('忆境纪念盒','忆境纪念盒','locket',[
  ['滚石任务',SS_quest('Rock Rollers')],...SS_w(['Bone_18','Crawl_09','Dock_13']),['朝圣者憩所商店',SS_generic('PurchasedPilgrimsRestMemoryLocket')],...SS_w(['Ant_20','Greymoor_16','Halfway_01']),['钟心镇商店',SS_generic('PurchasedBelltownMemoryLocket')],['珊瑚区域',SS_world('Coral_02','Collectable Item Pickup (1)')],...SS_w(['Slab_Cell_Quiet','Shadow_20']),['阴影区域尸袋',SS_world('Shadow_27','Sack Corpse Pickup')],...SS_w(['Coral_23','Under_08','Bellway_City','Library_08','Arborium_05','Bone_East_25','Belltown'])]),
 SS_mk('制造金属','制造金属','metal',[
  ['骸底镇商店',SS_generic('PurchasedBonebottomToolMetal')],['髓骨洞窟',SS_world('Bone_07','Collectable Item Pickup - Tool Metal')],...SS_w(['Dock_03']),['珊瑚区域',SS_world('Coral_32','Collectable Item Pickup - Tool Metal')],['地下区域',SS_world('Under_19b','Collectable Item Pickup - Tool Metal')],['商人飞地',SS_generic('MerchantEnclaveToolMetal')],['幽光区域',SS_world('Wisp_05','Collectable Item Pickup - Tool Metal')],['水道区域',SS_world('Aqueduct_05','Collectable Item Pickup - Tool Metal')]]),
 SS_mk('圣咏音筒','圣咏音筒','cylinder',[...['Librarian Melody Cylinder','Psalm Cylinder Librarian','Psalm Cylinder Library Roof','Psalm Cylinder Grindle','Psalm Cylinder Ward','Psalm Cylinder Hang'].map(n=>['',SS_relic(n)])]),
 SS_mk('丝之心','丝之心','heart',[...['Memory_Silk_Heart_BellBeast','Memory_Silk_Heart_WardBoss','Memory_Silk_Heart_LaceTower'].map(n=>['',SS_world(n,'glow_rim_Remasker')])]),
 SS_mk('迷途跳蚤','迷途跳蚤','flea',SS_g(['SavedFlea_Bone_06','SavedFlea_Dock_16','SavedFlea_Bone_East_05','SavedFlea_Bone_East_17b','SavedFlea_Ant_03','SavedFlea_Greymoor_15b','SavedFlea_Greymoor_06','SavedFlea_Shellwood_03','SavedFlea_Bone_East_10_Church','SavedFlea_Coral_35','SavedFlea_Dust_12','SavedFlea_Dust_09','SavedFlea_Belltown_04','SavedFlea_Crawl_06','SavedFlea_Slab_Cell','SavedFlea_Shadow_28','SavedFlea_Dock_03d','SavedFlea_Under_23','SavedFlea_Shadow_10','SavedFlea_Song_14','SavedFlea_Coral_24','SavedFlea_Peak_05c','CaravanLechSaved','SavedFlea_Library_09','SavedFlea_Song_11','SavedFlea_Library_01','SavedFlea_Under_21','SavedFlea_Slab_06','tamedGiantFlea','MetTroupeHunterWild'])),
 SS_mk('苔莓','苔莓','berry',[
  ['苔藓洞窟 (1/5)',SS_world('Tut_01b','moss_berry_fruit')],
  ['苔藓洞窟 (2/5)',SS_world('Tut_02','moss_berry_fruit')],
  ['苔藓洞窟 (3/5)',SS_generic('bonetownAspidBerryCollected')],
  ['苔藓洞窟 (4/5)',SS_generic('mosstownAspidBerryCollected')],
  ['苔藓洞窟 (5/5)',SS_generic('bonegraveAspidBerryCollected')],
  ['织网所阿特拉',SS_world('Weave_03','moss_berry_fruit')],
  ['忆境（纪念树林）',SS_world('Arborium_04','moss_berry_fruit')],
 ])
];
function ssFound(d, c){
  if (c.kind==='world') return d.flags.some(x=>x.SceneName===c.scene && x.ID===c.id && x.Value===true);
  if (c.kind==='generic') return d.pd[c.key]===true;
  if (c.kind==='quest') return (d.pd.QuestCompletionData?.savedData||[]).some(x=>x.Name===c.name && x.Data?.IsCompleted===true);
  return (d.pd.Relics?.savedData||[]).some(x=>x.Name===c.name && x.Data?.IsCollected===true);
}
function ssRender(save){
  const pd = save.playerData, flags = save.sceneData?.persistentBools?.serializedList;
  const d = { pd, flags };
  state.analysed = SS_GROUPS.map(g => ({...g, items:g.items.map(x => ({...x, owned:ssFound(d,x.check)}))}));
  const all = state.analysed.flatMap(g=>g.items), fleas = state.analysed.find(g=>g.id==='flea').items;
  $('#special-label').textContent = '迷途跳蚤';
  $('#total').textContent = `${all.filter(x=>x.owned).length} / ${all.length}`;
  $('#special').textContent = `${fleas.filter(x=>x.owned).length} / ${fleas.length}`;
  $('#completion').textContent = pd.completionPercentage==null?'未知':`${pd.completionPercentage}%`;
  $('#inventory-wrap').hidden = true;
  drawSS();
}
function drawSS(){
  const root = $('#sections'); root.innerHTML = '';
  for (const g of state.analysed){
    const shown = g.items.filter(x => state.filter==='all' || (state.filter==='owned' ? x.owned : !x.owned));
    if (!shown.length) continue;
    const n = g.items.filter(x=>x.owned).length;
    const sec = document.createElement('section'); sec.className='group';
    sec.innerHTML = `<h2><span><img class="group-icon" src="assets/${SS_ICONS[g.id]}" alt="">${g.title}</span><small>${n} / ${g.items.length}</small></h2><div class="grid">${shown.map(x=>`<article class="item ${x.owned?'owned':''}"><img class="item-icon" src="assets/${SS_ICONS[g.id]}" alt=""><span class="status">${x.owned?'✓':'×'}</span><div><b>${x.name}</b><div class="where">${x.where}</div></div><a target="_blank" rel="noreferrer" href="${SS_WIKI+encodeURIComponent(g.wiki)}">中文维基 ↗</a></article>`).join('')}</div>`;
    root.append(sec);
  }
}
function draw(){ if (state.game==='hk') drawHK(); else drawSS(); }

// ============================================================
// 游戏识别 / 载入
// ============================================================
function detectGame(save){
  const pd = save.playerData || {};
  const sd = save.sceneData || {};
  // 场景数据结构是最可靠的判别信号：
  // 丝之歌用 persistentBools，空洞骑士用 persistentBoolItems。
  // 先判丝之歌，避免空洞骑士共有的 maxHealthBase / permadeathMode 造成误判。
  if (sd.persistentBools) return 'ss';
  if (Array.isArray(sd.persistentBoolItems)) return 'hk';
  // 兜底：用只有单方独有的字段。古董(trinket)是空洞骑士专属；silkMax 等是丝之歌专属。
  if (pd.silkMax !== undefined || pd.silkRegenMax !== undefined || pd.ShellShards !== undefined) return 'ss';
  if (pd.trinket1 !== undefined) return 'hk';
  return null;
}
function gameName(g){ return g==='hk' ? '《空洞骑士》' : '《空洞骑士：丝之歌》'; }
function fmtTime(sec){
  sec = Math.max(0, Number(sec)||0);
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = Math.floor(sec%60);
  return {h,m,s,str:`${h} 时 ${m} 分 ${s} 秒`};
}

async function loadFile(file){
  if (!file) return;
  hideError();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isJson = file.name.toLowerCase().endsWith('.json') || bytes[0] === 123;
    let save, header = null, trailer = null;
    if (isJson){
      save = JSON.parse(new TextDecoder().decode(bytes));
    } else {
      const r = decodeSave(bytes);
      save = JSON.parse(r.json); header = r.header; trailer = r.trailer;
    }
    const game = detectGame(save);
    if (!game) throw new Error('无法识别这是《空洞骑士》还是《丝之歌》的存档');
    state = { ...state, save, game, header, trailer, isDat: !isJson, filename: file.name, filter:'all' };
    $('#game').textContent = gameName(game);
    $('#filelabel').textContent = '当前存档：' + file.name;
    $('#dashboard').hidden = false;
    if (game === 'hk') hkRender(save); else ssRender(save);
    buildEditor(game);
    switchView('parse');
  } catch (e){
    showError(`无法解析：${e.message}。请确认是 PC 版的 user*.dat，或已解密的 JSON。`);
    $('#dashboard').hidden = true;
  }
}

// ============================================================
// 修改（编辑器）
// ============================================================
function pmLabel(v){
  if (v === 0 || v === false || v === '') return '普通';
  if (v === 1 || v === 'On' || v === true) return '钢魂';
  if (v === 2 || v === 'Dead') return '钢魂 · 已碎档';
  if (v === 3) return '钢魂（异常版，可死亡）';
  return String(v);
}
function buildEditor(game){
  const wrap = $('#preset-fields');
  wrap.innerHTML = '';
  const pd = state.save.playerData || {};
  const now = fmtTime(pd.playTime);

  // —— 钢魂模式（空洞骑士与丝之歌均有此模式）——
  {
    const sec = el('section','editor-block');
    sec.innerHTML = `<h3>钢魂模式（永久死亡）</h3>
      <p class="hint">当前：<b id="pm-label">${pmLabel(pd.permadeathMode)}</b>　死亡计数：${Number(pd.permadeathCount)||0}</p>
      <div class="btnrow">
        <button type="button" data-act="steel">修复 · 恢复为钢魂模式</button>
        <button type="button" data-act="normal">修复 · 转为普通模式</button>
      </div>
      <p class="hint">碎档后 permadeathMode 会变成 2（或 "Dead"）。点击上方按钮会把它改回 1（钢魂）或 0（普通），并把死亡计数归零、解除死亡状态，之后可正常游玩。</p>`;
    wrap.append(sec);
  }

  // —— 吉欧 / 货币 ——
  const geoFields = game === 'hk'
    ? [{key:'geo',label:'当前吉欧'},{key:'geoPool',label:'影魂持有的吉欧'}]
    : [{key:'geo',label:'当前吉欧'}];
  wrap.append(buildNumberGroup('货币 / 吉欧', geoFields));

  // —— 游戏时长 ——
  const time = el('section','editor-block');
  time.innerHTML = `<h3>游戏时长</h3><p class="hint">当前：<b>${now.str}</b></p>
    <div class="timegrid">
      <label>时<input id="t-h" type="number" min="0" value="${now.h}"></label>
      <label>分<input id="t-m" type="number" min="0" max="59" value="${now.m}"></label>
      <label>秒<input id="t-s" type="number" min="0" max="59" value="${now.s}"></label>
    </div>`;
  wrap.append(time);

  // —— 血量 / 面具 ——
  const hpFields = game === 'hk'
    ? [{key:'maxHealthBase',label:'基础最大面具（来自碎片）'},{key:'health',label:'当前血量'},{key:'maxHealth',label:'当前最大血量（含蓝血）'},{key:'maxHealthBlue',label:'蓝血 / 生命血'}]
    : [{key:'maxHealth',label:'当前最大血量（面具）'}];
  wrap.append(buildNumberGroup('血量 / 面具', hpFields));

  // 应用按钮
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'primary'; btn.id = 'apply-preset';
  btn.textContent = '应用修改并重新解析';
  wrap.append(btn);

  // 高级 JSON 编辑器
  $('#json-editor').value = JSON.stringify(state.save, null, 2);

  // 钢魂按钮事件
  wrap.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const mode = b.dataset.act === 'steel' ? 1 : 0;
    const pd2 = state.save.playerData;
    if ('permadeathMode' in pd2) pd2.permadeathMode = mode;
    if ('permadeathCount' in pd2) pd2.permadeathCount = 0;
    if ('playerDead' in pd2) pd2.playerDead = false;
    const labels = {1:'钢魂',0:'普通'};
    setMsg('修改成功：已将钢魂模式改为「' + labels[mode] + '」，死亡计数已归零。记得「下载加密 .dat」保存。');
    $('#pm-label').textContent = labels[mode];
    syncJsonEditor();
  }));
  // 预设应用
  $('#apply-preset').addEventListener('click', applyPresets);
  // JSON 校验应用
  $('#apply-json').addEventListener('click', applyJsonEditor);
  // 下载
  $('#download-dat').addEventListener('click', () => downloadDat());
  $('#download-json').addEventListener('click', () => downloadJson());
}

function el(tag, cls){
  const n = document.createElement(tag); if (cls) n.className = cls; return n;
}
function buildNumberGroup(title, fields){
  const sec = el('section','editor-block');
  sec.innerHTML = `<h3>${title}</h3>`;
  const grid = el('div','numbergrid');
  const pd = state.save.playerData;
  fields.forEach(f => {
    const cur = pd[f.key];
    const wrap = el('label');
    wrap.innerHTML = `<span>${f.label}</span>`;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = 0; inp.value = cur ?? '';
    inp.dataset.key = f.key;
    wrap.append(inp);
    grid.append(wrap);
  });
  sec.append(grid);
  return sec;
}
function collectNumberEdits(){
  const edits = {};
  document.querySelectorAll('#preset-fields input[data-key]').forEach(inp => {
    const k = inp.dataset.key;
    if (inp.value !== '' && !isNaN(inp.value)) edits[k] = Math.max(0, Math.round(Number(inp.value)));
  });
  // 游戏时长
  const h = Number($('#t-h')?.value)||0, m = Number($('#t-m')?.value)||0, s = Number($('#t-s')?.value)||0;
  const total = h*3600 + m*60 + s;
  if (!isNaN(total)) edits.playTime = total;
  return edits;
}
function applyPresets(){
  const pd = state.save.playerData;
  const edits = collectNumberEdits();
  Object.entries(edits).forEach(([k,v]) => { pd[k] = v; });
  // 重新解析以反映变化
  if (state.game==='hk') hkRender(state.save); else ssRender(state.save);
  setMsg('已应用修改并重新解析。请用下方「下载加密 .dat」导出新存档。');
  syncJsonEditor();
}
function syncJsonEditor(){
  if (state.save) $('#json-editor').value = JSON.stringify(state.save, null, 2);
}
function applyJsonEditor(){
  try {
    const parsed = JSON.parse($('#json-editor').value);
    const g = detectGame(parsed);
    if (!g) throw new Error('修改后的 JSON 不再像有效存档');
    if (g !== state.game) throw new Error('检测到的游戏与原档不一致');
    state.save = parsed;
    if (g==='hk') hkRender(parsed); else ssRender(parsed);
    setMsg('JSON 校验通过并已应用。请下载保存。');
  } catch(e){
    setMsg('JSON 无效：' + e.message, true);
  }
}
function currentJson(){ return JSON.stringify(state.save); }
function baseName(){
  const n = state.filename || 'user1.dat';
  const dot = n.lastIndexOf('.');
  return dot > 0 ? n.slice(0, dot) : n;
}
function downloadDat(){
  try {
    const dat = encodeDat(currentJson(), state.header, state.trailer);
    download(dat, baseName() + '_edited.dat', 'application/octet-stream');
    setMsg('已导出加密存档：' + baseName() + '_edited.dat');
  } catch(e){ setMsg('导出失败：' + e.message, true); }
}
function downloadJson(){
  try {
    const txt = currentJson();
    download(new TextEncoder().encode(txt), baseName() + '_edited.json', 'application/json');
    setMsg('已导出明文 JSON：' + baseName() + '_edited.json');
  } catch(e){ setMsg('导出失败：' + e.message, true); }
}

function setMsg(text, isError){
  const m = $('#preset-msg'); m.textContent = text; m.hidden = false;
  m.className = 'note ' + (isError ? 'err' : 'ok');
}
function showError(t){ const e=$('#error'); e.textContent=t; e.hidden=false; }
function hideError(){ $('#error').hidden = true; }

// ============================================================
// 视图切换 / 事件
// ============================================================
function switchView(view){
  $('#parse-view').hidden = view !== 'parse';
  $('#edit-view').hidden = view !== 'edit';
  document.querySelectorAll('#viewtabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}
function init(){
  ECB = new aesjs.ModeOfOperation.ecb(AES_KEY);
  $('#file').addEventListener('change', e => loadFile(e.target.files[0]));
  const drop = $('#drop');
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, x => { x.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, x => { x.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  $('#viewtabs').addEventListener('click', e => {
    if (e.target.dataset.view) switchView(e.target.dataset.view);
  });
  $('#filters').addEventListener('click', e => {
    if (!e.target.dataset.filter) return;
    state.filter = e.target.dataset.filter;
    document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('active', b === e.target));
    draw();
  });
}
document.addEventListener('DOMContentLoaded', init);
