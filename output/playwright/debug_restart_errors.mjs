import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000}});
page.on('pageerror', e=>console.log('PAGEERROR',e.message));
page.on('console', m=>console.log('CONSOLE',m.type(),m.text()));
await page.goto('http://localhost:8082',{waitUntil:'networkidle',timeout:120000});
await page.waitForTimeout(700);
if(await page.getByText('Continue Game',{exact:true}).count()){
  await page.getByText('Continue Game',{exact:true}).click();
  await page.waitForTimeout(1000);
}
// force dead state quickly
await page.evaluate(()=>{
 const raw=localStorage.getItem('characters');
 if(raw){const obj=JSON.parse(raw); obj.character.stats.health=1; localStorage.setItem('characters',JSON.stringify(obj));}
});
await page.reload({waitUntil:'networkidle'});
if(await page.getByText('Continue Game',{exact:true}).count()){
  await page.getByText('Continue Game',{exact:true}).click();
  await page.waitForTimeout(1000);
}
if(await page.getByText('Right',{exact:true}).count()){
  await page.getByText('Right',{exact:true}).click();
  await page.waitForTimeout(500);
}
if(await page.locator('text=/Life:/').count()){
  await page.locator('text=/Life:/').first().click();
}
for(let i=0;i<30;i++){
  const t=await page.locator('body').innerText();
  if(t.includes('YOU DIED')) break;
  await page.waitForTimeout(300);
}
console.log('BEFORE_CLICK_HP', await page.locator('body').innerText());
if(await page.getByText('Restart',{exact:true}).count()){
  await page.getByText('Restart',{exact:true}).click();
  await page.waitForTimeout(1200);
}
const raw=await page.evaluate(()=>localStorage.getItem('characters'));
console.log('LOCAL_AFTER_CLICK', raw?.slice(0,180));
const txt=await page.locator('body').innerText();
console.log('AFTER_HAS_DIED',txt.includes('YOU DIED'));
await page.screenshot({path:'output/playwright/33_restart_error_debug.png',fullPage:true});
await browser.close();
