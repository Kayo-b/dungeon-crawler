import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.goto('http://localhost:8082',{waitUntil:'networkidle'});
await page.waitForTimeout(700);
if(await page.getByText('Continue Game',{exact:true}).count()){
  await page.getByText('Continue Game',{exact:true}).click();
  await page.waitForTimeout(1000);
}
// assume overlay visible already from previous run
console.log('HAS_RESTART', await page.getByText('Restart',{exact:true}).count());
if(await page.getByText('Restart',{exact:true}).count()){
  await page.getByText('Restart',{exact:true}).click();
  await page.waitForTimeout(1200);
}
const hp=await page.evaluate(()=>{const raw=localStorage.getItem('characters'); if(!raw) return null; return JSON.parse(raw).character.stats.health;});
const txt=await page.locator('body').innerText();
console.log('LOCAL_HP_AFTER_CLICK',hp);
console.log('HAS_DIED',txt.includes('YOU DIED'));
console.log('PLAYER_HP_TEXT', (txt.match(/HP\s*-?\d+/)||[])[0]);
await page.screenshot({path:'output/playwright/32_debug_restart.png',fullPage:true});
await browser.close();
