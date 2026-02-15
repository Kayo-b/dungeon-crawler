import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.goto('http://localhost:8082',{waitUntil:'networkidle',timeout:120000});
await page.waitForTimeout(1200);
const keys=await page.evaluate(()=>Object.keys(window).filter(k=>k.toLowerCase().includes('store')||k.toLowerCase().includes('redux')||k.toLowerCase().includes('expo')).slice(0,80));
console.log(keys);
await browser.close();
