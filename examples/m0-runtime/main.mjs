import * as cc from 'cocosair';
import {spriteFile,verifyBytes} from './manifest-check.mjs';
const result={status:'RUNNING',checks:[],errors:[]};window.__m0=result;
const check=(ok,name)=>{result.checks.push({name,pass:!!ok});if(!ok)throw new Error(name);};
try {
 const start=performance.now();
 const manifest=await (await fetch('./asset-manifest.json')).json();
 const spec=await (await fetch('/fixtures/game-specs/arcade_shooter.json')).json();
 const state=spec.content.extensions.arcade_shooter;
 const {binding,file,path}=spriteFile(manifest,'player.main');check(true,'validated manifest player.main binding');
 const response=await fetch('./'+path);check(response.ok,'actual PNG fetched');const bytes=await response.arrayBuffer();
 await verifyBytes(bytes,file,crypto.subtle);check(true,'PNG byte hash verified');
 const image=new Image();const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
 try{image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
 const canvas=document.querySelector('canvas');const app=await cc.createAirApp({canvas,screenMode:'container',container:'#stage',pixelRatioCap:1,designResolution:{width:400,height:400,policy:0}});
 const scene=new cc.Scene('A2Asset M0');const ui=cc.createUICanvas(scene,'UI',{designWidth:400,designHeight:400});ui.getComponentInChildren(cc.Camera).clearColor=new cc.Color(16,37,43,255);
 const imageAsset=new cc.ImageAsset(image);const texture=new cc.Texture2D();texture.image=imageAsset;texture.setFilters(cc.Texture2D.Filter.NEAREST,cc.Texture2D.Filter.NEAREST);
 const sprite=cc.createAirTextureSprite(ui,texture,{name:'player.main',size:[binding.logicalSize[0]*4,binding.logicalSize[1]*4],anchor:binding.pivot});
 // Exact GameSpec initial coordinate projection: only presentation, no rule changes.
 sprite.node.setPosition((state.playerX/state.width-.5)*400,(.5-state.playerY/state.height)*400,0);
 app.run(scene);const clock=cc.createStepClock();clock.begin();await clock.step();await clock.step();
 const gl=canvas.getContext('webgl2');const rgba=new Uint8Array(4);gl.readPixels(200,80,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 result.pixel=Array.from(rgba);check(rgba[1]>150 && rgba[0]<100,'texture contributes actual framebuffer pixels');check(gl.getError()===gl.NO_ERROR,'WebGL error free');
 result.device={webgl2:true,maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),renderer:gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent,canvas:[canvas.width,canvas.height]};result.loadMs=performance.now()-start;
 result.engineExports=['createAirApp','createUICanvas','Texture2D','ImageAsset','createAirTextureSprite','SpriteFrame','Animation','AudioSource','AudioService','Font','AssetBank'].map(name=>({name,present:typeof cc[name]!=='undefined'}));
 result.status='PASS';document.querySelector('#status').textContent=JSON.stringify(result,null,2);
 window.__disposeM0=async()=>{sprite.dispose();texture.destroy();imageAsset.destroy();await clock.step();await clock.step();const released=!sprite.node.isValid&&!sprite.frame.isValid&&!texture.isValid;check(released,'owned sprite/frame/texture released');clock.end();return{released};};
} catch(error){result.status='FAIL';result.errors.push(String(error.stack||error));document.querySelector('#status').textContent=JSON.stringify(result,null,2);}
