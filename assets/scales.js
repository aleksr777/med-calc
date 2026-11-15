(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ClinicalScales=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function sum(options){if(!Array.isArray(options)||options.some(x=>x===null||x===undefined||!Number.isInteger(x)))return null;return options.reduce((a,b)=>a+b,0)}
function number(value,min,max){if(value===null||value===undefined||String(value).trim()==='')return null;const raw=String(value).replace(',','.');if(!/^(?:\d+)(?:\.\d+)?$/.test(raw))return null;const n=Number(raw);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function news2(d){const rr=number(d.rr,1,100),spo2=number(d.spo2,1,100),sbp=number(d.sbp,1,350),pulse=number(d.pulse,1,300),temp=number(d.temp,25,45);if([rr,spo2,sbp,pulse,temp].includes(null)||!['0','1'].includes(String(d.oxygen))||!['1','2'].includes(String(d.scale))||!['0','3'].includes(String(d.consciousness)))return null;
const oxygen=Number(d.oxygen),scale=Number(d.scale);let saturation=scale===1?(spo2<=91?3:spo2<=93?2:spo2<=95?1:0):(spo2<=83?3:spo2<=85?2:spo2<=87?1:spo2<=92?0:!oxygen?0:spo2<=94?1:spo2<=96?2:3);
const parts={respiration:rr<=8||rr>=25?3:rr<=11?1:rr<=20?0:2,saturation,oxygen:oxygen*2,systolic:sbp<=90||sbp>=220?3:sbp<=100?2:sbp<=110?1:0,pulse:pulse<=40||pulse>=131?3:pulse<=50?1:pulse<=90?0:pulse<=110?1:2,temperature:temp<=35?3:temp<=36?1:temp<=38?0:temp<=39?1:2,consciousness:Number(d.consciousness)};const score=Object.values(parts).reduce((a,b)=>a+b,0);return {score,parts,red:score>=7,urgent:score>=5||Object.values(parts).some(x=>x===3),level:score>=7?'Высокий риск':score>=5||Object.values(parts).some(x=>x===3)?'Средний риск / отдельный показатель 3':'Низкий риск'} }
function sofa(d){const pa=number(d.pao2,1,800),fio=number(d.fio2,21,100),platelets=number(d.platelets,0,2000),bili=number(d.bilirubin,0,2000),creat=number(d.creatinine,0,4000),gcs=number(d.gcs,3,15),map=number(d.map,0,200),urine=d.urine===''||d.urine==null?null:number(d.urine,0,10000);
if([pa,fio,platelets,bili,creat,gcs,map].includes(null)||!['none','dobutamine','dopamine-low','dopamine-mid','dopamine-high','pressor-low','pressor-high'].includes(d.pressors)||!['0','1'].includes(String(d.support))||(d.urine!==''&&d.urine!=null&&urine===null))return null;
const ratio=pa/(fio/100),support=String(d.support)==='1';
const respiratory=ratio>=400?0:ratio>=300?1:ratio>=200?2:!support?2:ratio>=100?3:4;
const coagulation=platelets>=150?0:platelets>=100?1:platelets>=50?2:platelets>=20?3:4;
const liver=bili<20?0:bili<33?1:bili<102?2:bili<205?3:4;
const cardiovascular=d.pressors==='pressor-high'||d.pressors==='dopamine-high'?4:d.pressors==='pressor-low'||d.pressors==='dopamine-mid'?3:d.pressors==='dobutamine'||d.pressors==='dopamine-low'?2:map<70?1:0;
const cns=gcs===15?0:gcs>=13?1:gcs>=10?2:gcs>=6?3:4;
let renal=creat<110?0:creat<171?1:creat<300?2:creat<=440?3:4;
if(urine!==null)renal=Math.max(renal,urine<200?4:urine<500?3:0);
const parts={respiratory,coagulation,liver,cardiovascular,cns,renal};return {score:Object.values(parts).reduce((a,b)=>a+b,0),parts,ratio};}
return Object.freeze({sum,number,news2,sofa});
});