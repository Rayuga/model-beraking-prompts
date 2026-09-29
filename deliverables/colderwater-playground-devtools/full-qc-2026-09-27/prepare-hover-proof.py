from pathlib import Path
import shutil
out=Path(__file__).resolve().parent
folder=out/'presentation-final';old=out/'presentation-before-hover-fix'
if not old.exists():shutil.copytree(folder,old)
p=folder/'probe.cjs';s=p.read_text()
helper="""async function hoverProof(){const button=page.getByRole('button',{name:/^Run/});await button.hover();const value=await button.evaluate(e=>{const s=getComputedStyle(e);const lum=v=>{const rgb=v.match(/[\\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const a=lum(s.color),b=lum(s.backgroundColor);return{color:s.color,background:s.backgroundColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),theme:document.documentElement.dataset.theme,width:innerWidth}});assert(value.contrast>=4.5);(report.runHover??=[]).push(value);}
"""
s=s.replace("async function main(){",helper+"\nasync function main(){")
s=s.replace("await page.screenshot({path:out+'/desktop-theme-a.png'","await hoverProof();await page.screenshot({path:out+'/desktop-theme-a.png'")
s=s.replace("await page.screenshot({path:out+'/desktop-theme-b.png'","await hoverProof();await page.screenshot({path:out+'/desktop-theme-b.png'")
s=s.replace("for(let t=0;t<2;t++){await page.screenshot","for(let t=0;t<2;t++){await hoverProof();await page.screenshot")
p.write_text(s,encoding='utf-8',newline='\n')
print('hover probes ready')
