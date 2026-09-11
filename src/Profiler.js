export function criarProfiler(renderer,{enabled=false,getContext=()=>({})}={}){
  if(!enabled)return{frame(){}};

  const panel=document.createElement('div');
  panel.id='devProfiler';
  panel.style.cssText=[
    'position:fixed','z-index:99','right:10px','top:10px','min-width:220px',
    'padding:10px 12px','border-radius:10px','background:rgba(5,8,10,.88)',
    'border:1px solid rgba(140,220,160,.45)','color:#dff6e4',
    'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'pointer-events:none','white-space:pre','box-shadow:0 8px 24px rgba(0,0,0,.25)'
  ].join(';');
  document.body.appendChild(panel);

  const samples=[];
  let elapsed=0,worst=0;

  function percentile95(values){
    if(!values.length)return 0;
    const s=[...values].sort((a,b)=>a-b);
    return s[Math.min(s.length-1,Math.floor(s.length*.95))];
  }

  function frame(dt){
    const ms=dt*1000;
    samples.push(ms);
    if(samples.length>120)samples.shift();
    worst=Math.max(worst,ms);
    elapsed+=dt;
    if(elapsed<.35)return;
    elapsed=0;

    const avg=samples.reduce((a,b)=>a+b,0)/Math.max(1,samples.length);
    const p95=percentile95(samples);
    const fps=avg>0?1000/avg:0;
    const info=renderer.info;
    const ctx=getContext()||{};
    const heap=performance.memory
      ?`${(performance.memory.usedJSHeapSize/1048576).toFixed(0)} MB`
      :'n/d';

    const warn=fps<45?'  ⚠':fps<58?'  △':'';
    panel.textContent=
`Q3D DEV PROFILER${warn}
FPS médio     ${fps.toFixed(0)}
frame médio   ${avg.toFixed(1)} ms
frame p95     ${p95.toFixed(1)} ms
pior frame    ${worst.toFixed(1)} ms

draw calls     ${info.render.calls}
triângulos     ${info.render.triangles}
geometrias     ${info.memory.geometries}
texturas       ${info.memory.textures}
programas      ${info.programs?.length??0}
JS heap        ${heap}
pixel ratio    ${renderer.getPixelRatio().toFixed(2)}

modo           ${ctx.mode||'-'}
zona           ${ctx.zone||'-'}
x/z            ${ctx.x?.toFixed?.(1)??'-'} / ${ctx.z?.toFixed?.(1)??'-'}`;
  }

  return{frame};
}
