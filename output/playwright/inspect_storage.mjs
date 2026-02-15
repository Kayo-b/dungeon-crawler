import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.goto('http://localhost:8082',{waitUntil:'networkidle',timeout:120000});
await page.waitForTimeout(800);
await page.getByText('New Game',{exact:true}).click();
await page.getByPlaceholder('Character name').fill('Storage QA');
await page.getByText('Melee Warrior').click();
await page.getByText('Start Adventure').click();
await page.waitForTimeout(1200);
const local=await page.evaluate(()=>{
 const out={};
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); out[k]=localStorage.getItem(k);} 
 return out;
});
console.log('LOCAL_KEYS',Object.keys(local));
const dbs=await page.evaluate(async()=>{ if(!indexedDB.databases) return []; return await indexedDB.databases();});
console.log('INDEXED_DBS',dbs);
await browser.close();
