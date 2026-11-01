// Technical integration scenarios, not four production games or human visual acceptance.
import * as cc from 'cocosair';
import {createCocosAssetRuntime} from '/runtime/index.js';
import * as falling from '/reference/archetypes/falling_blocks.mjs';
import * as match3 from '/reference/archetypes/match3.mjs';
import * as shooter from '/reference/archetypes/arcade_shooter.mjs';
import {hash} from '/reference/core/index.mjs';
const result=window.__four={status:'RUNNING',checks:[],scenarios:[]};
function check(ok,name){result.checks.push({name,pass:!!ok});if(!ok)throw Error(name);}
const seed=712367;
try{
 const app=await cc.createAirApp({canvas:document.querySelector('canvas'),screenMode:'container',container:'#stage',pixelRatioCap:1,designResolution:{width:400,height:400,policy:0}});
 const scene=new cc.Scene('Synthetic four scenarios'),ui=cc.createUICanvas(scene,'UI',{designWidth:400,designHeight:400});ui.getComponentInChildren(cc.Camera).clearColor=new cc.Color(16,37,43,255);app.run(scene);
 const clock=cc.createStepClock();clock.begin();const rt=createCocosAssetRuntime(cc),gl=document.querySelector('canvas').getContext('webgl2');
 const pixel=(x,y)=>{const b=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,b);return [...b];};
 let active=null,views=[],mode=0,theme='mint',logic=null,output=null,sound=null;
 function clearViews(){for(const v of views)rt.releaseAsset(v);views=[];}
 function sprite(x,y,size=16){const s=rt.acquireSprite(active,'player.main',ui);s.node.setPosition(x,y,0);s.node.getComponent(cc.UITransform).setContentSize(size,size);views.push(s);return s;}
 function draw(){clearViews();const hud=rt.acquireSprite(active,'ui.button',ui);hud.node.setPosition(0,170,0);views.push(hud);
  if(mode===0){logic.state.board.forEach((row,y)=>row.forEach((v,x)=>{if(v)sprite(-90+x*18,150-y*15,14);}));}
  if(mode===1){logic.state.board.forEach((row,y)=>row.forEach((v,x)=>{const s=sprite(-64+x*32,64-y*32,28);s.sprite.color=new cc.Color(255,255-v*35,255-v*25,255);}));}
  if(mode===2){const s=logic.state;sprite((s.player.x-50)*3,(50-s.player.y)*3,20);for(const enemy of s.enemies)if(enemy.hp>0)sprite((enemy.x-50)*3,(50-enemy.y)*3,16);for(const bullet of s.projectiles)sprite((bullet.x-50)*3,(50-bullet.y)*3,5);}
  if(mode===3){for(let i=0;i<2;i++){const tile=rt.acquireTilemap(active,'map.main',ui);tile.node.setPosition(-96+i*96-logic.camera,-30,0);views.push(tile);}const s=rt.createAnimation(active,'player.main',logic.moving?'run':'idle',ui);s.advance(logic.tick*16);s.node.setPosition(logic.x-96-logic.camera,logic.y-18,0);views.push(s);}
 }
 function initial(which){mode=which;if(which<3){const pkg=[falling,match3,shooter][which];logic=new pkg.Runtime(pkg.exampleSpec(which===2?{config:{enemies:[{x:50,y:70}],enemyHP:1,enemySpeed:0,enemyFireIntervalTicks:0,projectileSpeed:1200}}:{}));logic.reset({seed});}else logic={tick:0,x:20,y:0,vy:0,camera:0,moving:false};}
 async function load(name){if(active){clearViews();await rt.disposeBundle(active);await clock.step();await clock.step();check(Object.values(rt.stats()).every(n=>n===0),'scene transition releases all tracked resources');}active=await rt.loadBundle('/bundles/'+name+'/asset-manifest.json');theme=name;sound=null;}
 await load('mint');initial(0);draw();await clock.step();
 window.__action=async()=>{
  if(mode===0){output=logic.step({action:{hardDropPressed:true}});check(output.accepted&&logic.state.piecesLocked===1,'BG01 reference hard drop locks piece');}
  if(mode===1){output=logic.step({action:logic.legalActions()[0]});check(output.accepted&&logic.state.gemsCleared>=3&&logic.state.turn===1,'BG02 reference swap resolves match/cascade');}
  if(mode===2){output=logic.step({action:{move:[.3,0],aim:[0,-1],fire:true}});check(output.accepted&&logic.state.shots>0&&logic.state.player.x>50,'BG03 reference movement and shots advance');check(logic.state.hits===1&&logic.state.kills===1&&output.events.some(e=>e.type==='EntityDestroyed'&&e.entityType==='enemy'),'BG03 upstream collision destroys enemy without state mutation');sound=await rt.acquireAudio(active,'audio.hit',scene);sound.play();}
  if(mode===3){logic.vy=6;for(let i=0;i<90;i++){logic.tick++;logic.x=Math.min(180,logic.x+2);logic.vy-=.25;logic.y=Math.max(0,logic.y+logic.vy);if(logic.y===0)logic.vy=0;logic.camera=Math.max(0,logic.x-100);logic.moving=true;}check(logic.x===180&&logic.y===0&&logic.camera===80,'BG04 minimal platform jump lands, clamps and scrolls two map chunks');}
  draw();await clock.step();await clock.step();if(mode===2&&output.events.some(e=>e.type==='EntityDestroyed'&&e.entityType==='enemy')){const burst=rt.createAnimation(active,'vfx.hit','burst',ui);burst.node.setPosition(0,-60,0);await clock.step();const first=pixel(200,140);check(first[0]>220&&first[1]>180&&first[2]<60,'BG03 hit event renders built VFX first frame');burst.advance(90);await clock.step();const second=pixel(200,140);check(burst.frameIndex===1&&second[0]>200&&second[1]<80&&second[2]>150,'BG03 VFX animation selects actual second frame');burst.advance(70);burst.release();await clock.step();check(burst.released&&!burst.frame.isValid&&!burst.node.isValid,'BG03 completed burst releases its native frame and node');}const pixels=new Uint8Array(400*340*4);gl.readPixels(0,0,400,340,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let colored=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>40||pixels[i+1]>80||pixels[i+2]>80)colored++;check(colored>100,'actual scene framebuffer contains rendered gameplay BG0'+(mode+1));if(mode===3){check(pixel(204,182)[0]>200,'BG04 run animation selects actual second atlas frame');check(pixel(100,165)[0]>100,'BG04 scrolled map chunk contributes ground pixel');}return mode<3?hash(logic.state):hash(logic);
 };
 window.__run=async()=>{
  const fingerprints=[];
  for(let which=0;which<4;which++){
   const hashes=[];
   for(const name of ['mint','blue']){await load(name);initial(which);draw();await clock.step();hashes.push(await window.__action());if(which===2){result.status='AUDIO';await new Promise(resolve=>{window.__continue=resolve;});result.status='RUNNING';await new Promise(r=>setTimeout(r,180));check(sound.source.currentTime>0,'BG03 real audio playback clock advances');}const sample=sprite(0,0,24);await clock.step();const color=pixel(200,200);check(name==='mint'?color[1]>180:color[2]>180&&color[1]<130,'built theme changes actual sprite pixel: '+which+'/'+name);views.pop();sample.release();}
   check(hashes[0]===hashes[1],'theme switch preserves fixed-seed logic state BG0'+(which+1));fingerprints.push(hashes[0]);result.scenarios.push({id:'BG0'+(which+1),scope:which===3?'independent-minimal-platform':'pinned-reference-runtime',seed,themeStateHashes:hashes});
  }
  const before=rt.stats();let missing=false;try{await rt.loadBundle('/bundles/missing/asset-manifest.json');}catch(e){missing=e.code==='E_RUNTIME_LOAD';}check(missing&&rt.stats().bundles===before.bundles,'failed bundle fetch preserves current built scene');const mid=new AbortController(),partial=createCocosAssetRuntime(cc,{fetch:async(url,opts)=>{if(String(url).endsWith('.wav'))mid.abort();return fetch(url,opts);}});let rolled=false;try{await partial.loadBundle('/bundles/mint/asset-manifest.json',{signal:mid.signal});}catch(e){rolled=e.code==='E_CANCELLED';}check(rolled&&Object.values(partial.stats()).every(n=>n===0),'mid-load cancellation rolls back real Builder textures');const controller=new AbortController();controller.abort();let abort=false;try{await rt.loadBundle('/bundles/mint/asset-manifest.json',{signal:controller.signal});}catch(e){abort=e.code==='E_CANCELLED';}check(abort&&rt.stats().bundles===before.bundles,'cancelled real built bundle does not affect active scene');
  for(let i=0;i<3;i++){await load('mint');initial(0);draw();await clock.step();}
  clearViews();await rt.disposeBundle(active);await clock.step();await clock.step();check(Object.values(rt.stats()).every(n=>n===0),'repeated launch/exit leaves no tracked handles');check(gl.getError()===gl.NO_ERROR,'no WebGL error');clock.end();result.status='PASS';return result;
 };
 document.querySelector('#start').onclick=()=>{window.__running=window.__run().catch(e=>{result.status='FAIL';result.error=String(e.stack||e);return result;});};
 result.status='READY';
}catch(e){result.status='FAIL';result.error=String(e.stack||e);}
