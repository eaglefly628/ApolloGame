import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.RENDER_PROBE_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const evidence={browser:browser.version(),steps:[]};
try{
  const page=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:18844/');
  await page.bringToFront();
  evidence.web=await page.evaluate(async()=>{
    const before={width:innerWidth,height:innerHeight,enabled:document.fullscreenEnabled,active:navigator.userActivation.isActive,focus:document.hasFocus()};
    try{
      const entered=await Promise.race([document.documentElement.requestFullscreen().then(()=>true),new Promise(r=>setTimeout(()=>r(false),5000))]);
      const during={width:innerWidth,height:innerHeight,element:document.fullscreenElement?.tagName??null};
      if(entered)await document.exitFullscreen();
      return {before,during,after:{width:innerWidth,height:innerHeight,element:document.fullscreenElement?.tagName??null}};
    }catch(error){return {before,error:String(error)};}
  });
  const cdp=await page.context().newCDPSession(page);
  const {windowId}=await cdp.send('Browser.getWindowForTarget');
  for(const state of ['normal','fullscreen','normal']){
    try{
      await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:state}});
      const {bounds}=await cdp.send('Browser.getWindowBounds',{windowId});
      const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      const screenshot=await page.screenshot({path:new URL(`./evidence/browser-${state}-${evidence.steps.length}.png`,import.meta.url).pathname});
      evidence.steps.push({state,bounds,viewport,pixels:[screenshot.readUInt32BE(16),screenshot.readUInt32BE(20)]});
    }catch(error){evidence.steps.push({state,error:String(error)});}
  }
}finally{
  await writeFile(new URL('./evidence/fullscreen.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
  await browser.close();
}
