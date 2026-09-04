(() => {
  "use strict";
  const cfg = Object.assign({
    SIM_RESOLUTION:128, PRESSURE_ITERATIONS:18, FORCE:5200, SPLAT_RADIUS:0.018,
    VELOCITY_DISSIPATION:0.992, DYE_DISSIPATION:0.986,
    COLOR_SLOW:"#d9e4ce", COLOR_FAST:"#f0c64d", HIGHLIGHT:"#fff8e8",
    HIGHLIGHT_AMOUNT:0.12, DYE_AMOUNT:1.35, BLEND_MODE: "ink", INK_OPACITY: 0.85, BACKGROUND: "#0b0b0c",
    HOVER_INTERACTION:true, IDLE_MOTION:true, IDLE_INTERVAL_MS:2200,
    IDLE_FORCE:0.32, HIDE_HINT_ON_INTERACTION:true
  }, window.FLUID_CONFIG || {});

  const canvas = document.getElementById("fluid");
  const hint = document.getElementById("hint");
  const gl = canvas.getContext("webgl2", {alpha:false, antialias:false, depth:false, stencil:false});
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
    document.body.innerHTML = '<div style="padding:24px;color:white;font:16px system-ui;background:#111">This effect requires WebGL2 with floating-point render targets.</div>';
    return;
  }

  const VERT = `#version 300 es
  precision highp float; layout(location=0) in vec2 aPosition; out vec2 vUv;
  void main(){ vUv=aPosition*.5+.5; gl_Position=vec4(aPosition,0.,1.); }`;

  const ADVECT = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 outColor;
  uniform sampler2D uVelocity,uSource; uniform vec2 uTexel; uniform float uDt,uDissipation;
  void main(){ vec2 vel=texture(uVelocity,vUv).xy; vec2 coord=vUv-uDt*vel*uTexel; outColor=uDissipation*texture(uSource,coord); }`;

  const DIVERGENCE = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 outColor; uniform sampler2D uVelocity; uniform vec2 uTexel;
  void main(){ float L=texture(uVelocity,vUv-vec2(uTexel.x,0)).x; float R=texture(uVelocity,vUv+vec2(uTexel.x,0)).x; float B=texture(uVelocity,vUv-vec2(0,uTexel.y)).y; float T=texture(uVelocity,vUv+vec2(0,uTexel.y)).y; outColor=vec4(.5*((R-L)+(T-B)),0,0,1); }`;

  const PRESSURE = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 outColor; uniform sampler2D uPressure,uDivergence; uniform vec2 uTexel;
  void main(){ float L=texture(uPressure,vUv-vec2(uTexel.x,0)).x; float R=texture(uPressure,vUv+vec2(uTexel.x,0)).x; float B=texture(uPressure,vUv-vec2(0,uTexel.y)).x; float T=texture(uPressure,vUv+vec2(0,uTexel.y)).x; float d=texture(uDivergence,vUv).x; outColor=vec4((L+R+B+T-d)*.25,0,0,1); }`;

  const GRADIENT = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 outColor; uniform sampler2D uPressure,uVelocity; uniform vec2 uTexel;
  void main(){ float L=texture(uPressure,vUv-vec2(uTexel.x,0)).x; float R=texture(uPressure,vUv+vec2(uTexel.x,0)).x; float B=texture(uPressure,vUv-vec2(0,uTexel.y)).x; float T=texture(uPressure,vUv+vec2(0,uTexel.y)).x; vec2 v=texture(uVelocity,vUv).xy-.5*vec2(R-L,T-B); outColor=vec4(v,0,1); }`;

  const SPLAT = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 outColor; uniform sampler2D uTarget; uniform vec2 uPoint; uniform float uRadius,uAspect; uniform vec3 uValue;
  void main(){ vec2 p=vUv-uPoint; p.x*=uAspect; float f=exp(-dot(p,p)/max(uRadius,.000001)); outColor=texture(uTarget,vUv)+vec4(uValue*f,0); }`;

const DISPLAY = `#version 300 es
    precision highp float;

    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uDye;
    uniform vec3 uBackground;
    uniform int uBlendMode;
    uniform float uInkOpacity;

    void main() {

      vec3 rawDye = texture(uDye, vUv).rgb;

      // Keeps accumulated dye values in a manageable 0–1-ish range.
      vec3 dye = rawDye / (1.0 + rawDye);

      // Estimate how much pigment exists here.
      float density = max(
        dye.r,
        max(dye.g, dye.b)
      );

      density = clamp(
        density * uInkOpacity,
        0.0,
        1.0
      );

      vec3 color;

      // ----------------------------------
      // 0 — ADDITIVE / LIGHT
      // ----------------------------------
      if (uBlendMode == 0) {

        color = uBackground + dye;

      }

      // ----------------------------------
      // 1 — INK / LERP
      // ----------------------------------
      else if (uBlendMode == 1) {

        color = mix(
          uBackground,
          dye,
          density
        );

      }

      // ----------------------------------
      // 2 — MULTIPLY
      // ----------------------------------
      else if (uBlendMode == 2) {

        vec3 multiplied = uBackground * dye;

        color = mix(
          uBackground,
          multiplied,
          density
        );

      }

      // ----------------------------------
      // 3 — SUBTRACTIVE-ISH PIGMENT
      // ----------------------------------
      else {

        // Convert RGB pigment toward absorption.
        vec3 absorption = vec3(1.0) - dye;

        // More overlapping pigment means more absorbed light.
        vec3 transmitted = exp(
          -absorption * density * 3.0
        );

        color = uBackground * transmitted;

      }

      color = clamp(color, 0.0, 1.0);

      outColor = vec4(color, 1.0);
    }
`;

  function shader(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(fs){ const p=gl.createProgram(); gl.attachShader(p,shader(gl.VERTEX_SHADER,VERT)); gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
  const P={advect:program(ADVECT),divergence:program(DIVERGENCE),pressure:program(PRESSURE),gradient:program(GRADIENT),splat:program(SPLAT),display:program(DISPLAY)};

  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const vao=gl.createVertexArray(); gl.bindVertexArray(vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

  function makeTex(w,h){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null); return t; }
  function target(w,h){ const texture=makeTex(w,h), fbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0); return {texture,fbo,w,h}; }
  function dbl(w,h){ let a=target(w,h),b=target(w,h); return {get read(){return a},get write(){return b},swap(){const t=a;a=b;b=t}}; }
  let simW=0,simH=0,velocity,dye,pressure,divergence;
  function dispose(t){ if(!t)return; gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.fbo); }
  function disposeD(d){ if(d){dispose(d.read);dispose(d.write);} }
  function resizeSim(){ const a=canvas.width/Math.max(canvas.height,1); if(a>=1){simH=cfg.SIM_RESOLUTION;simW=Math.max(2,Math.round(simH*a));}else{simW=cfg.SIM_RESOLUTION;simH=Math.max(2,Math.round(simW/a));} disposeD(velocity);disposeD(dye);disposeD(pressure);dispose(divergence); velocity=dbl(simW,simH);dye=dbl(simW,simH);pressure=dbl(simW,simH);divergence=target(simW,simH); }
  function resize(){ const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(2,Math.floor(canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(canvas.clientHeight*dpr)); if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;resizeSim();} }
  function u(p,n){return gl.getUniformLocation(p,n)}
  function use(p){gl.useProgram(p);gl.bindVertexArray(vao)}
  function bind(unit,t,p,n){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(u(p,n),unit)}
  function draw(t){ if(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.viewport(0,0,t.w,t.h);}else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);} gl.drawArrays(gl.TRIANGLES,0,6); }
  function clear(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.viewport(0,0,t.w,t.h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)}

  function advect(src,vel,dst,diss,dt){const p=P.advect;use(p);bind(0,vel.texture,p,"uVelocity");bind(1,src.texture,p,"uSource");gl.uniform2f(u(p,"uTexel"),1/simW,1/simH);gl.uniform1f(u(p,"uDt"),dt);gl.uniform1f(u(p,"uDissipation"),diss);draw(dst)}
  function div(){const p=P.divergence;use(p);bind(0,velocity.read.texture,p,"uVelocity");gl.uniform2f(u(p,"uTexel"),1/simW,1/simH);draw(divergence)}
  function solve(){clear(pressure.read);clear(pressure.write);const p=P.pressure;use(p);gl.uniform2f(u(p,"uTexel"),1/simW,1/simH);bind(1,divergence.texture,p,"uDivergence");for(let i=0;i<cfg.PRESSURE_ITERATIONS;i++){bind(0,pressure.read.texture,p,"uPressure");draw(pressure.write);pressure.swap();}}
  function gradient(){const p=P.gradient;use(p);bind(0,pressure.read.texture,p,"uPressure");bind(1,velocity.read.texture,p,"uVelocity");gl.uniform2f(u(p,"uTexel"),1/simW,1/simH);draw(velocity.write);velocity.swap();}
  function splat(d,x,y,r,g,b,rad){const p=P.splat;use(p);bind(0,d.read.texture,p,"uTarget");gl.uniform2f(u(p,"uPoint"),x,y);gl.uniform1f(u(p,"uRadius"),rad*rad);gl.uniform3f(u(p,"uValue"),r,g,b);gl.uniform1f(u(p,"uAspect"),canvas.width/canvas.height);draw(d.write);d.swap();}
  function hex(s){const v=(s||"#000").replace("#","");const q=v.length===3?v.split("").map(c=>c+c).join(""):v,n=parseInt(q,16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]}
  function mix(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}
  const slow=hex(cfg.COLOR_SLOW),fast=hex(cfg.COLOR_FAST),hi=hex(cfg.HIGHLIGHT),bg=hex(cfg.BACKGROUND);
  function interact(x,y,dx,dy,strength=1){const speed=Math.min(1,Math.hypot(dx,dy)/45);let c=mix(slow,fast,speed);c=mix(c,hi,cfg.HIGHLIGHT_AMOUNT);splat(velocity,x,y,dx*cfg.FORCE*strength/Math.max(canvas.width,1),dy*cfg.FORCE*strength/Math.max(canvas.height,1),0,cfg.SPLAT_RADIUS);splat(dye,x,y,c[0]*cfg.DYE_AMOUNT*strength,c[1]*cfg.DYE_AMOUNT*strength,c[2]*cfg.DYE_AMOUNT*strength,cfg.SPLAT_RADIUS*1.2);if(cfg.HIDE_HINT_ON_INTERACTION&&hint)hint.classList.add("hidden");}
function render() {
  const p = P.display;

  use(p);

  bind(
    0,
    dye.read.texture,
    p,
    "uDye"
  );

  const background = hex(cfg.BACKGROUND);

  gl.uniform3f(
    u(p, "uBackground"),
    background[0],
    background[1],
    background[2]
  );

  const blendModes = {
    add: 0,
    ink: 1,
    multiply: 2,
    pigment: 3
  };

  const mode =
    blendModes[cfg.BLEND_MODE] !== undefined
      ? blendModes[cfg.BLEND_MODE]
      : 1;

  gl.uniform1i(
    u(p, "uBlendMode"),
    mode
  );

  gl.uniform1f(
    u(p, "uInkOpacity"),
    cfg.INK_OPACITY
  );

  draw(null);
}
  const pointers=new Map();
  function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height}}
  canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture(e.pointerId);const p=pos(e);p.down=true;pointers.set(e.pointerId,p)});
  canvas.addEventListener("pointermove",e=>{const p=pos(e),o=pointers.get(e.pointerId);if(!o){p.down=false;pointers.set(e.pointerId,p);return;}const dx=(p.x-o.x)*canvas.width,dy=(p.y-o.y)*canvas.height;if((cfg.HOVER_INTERACTION||o.down||e.buttons>0)&&Math.abs(dx)+Math.abs(dy)>.01)interact(p.x,p.y,dx,dy);o.x=p.x;o.y=p.y;o.down=o.down||e.buttons>0;});
  const release=e=>{const p=pointers.get(e.pointerId);if(p)p.down=false}; canvas.addEventListener("pointerup",release);canvas.addEventListener("pointerleave",release);canvas.addEventListener("pointercancel",e=>pointers.delete(e.pointerId));

  let prev=performance.now(),lastIdle=prev;
  function frame(now){resize();let dt=Math.min(Math.max((now-prev)/1000,1/240),1/30);prev=now;if(cfg.IDLE_MOTION&&now-lastIdle>cfg.IDLE_INTERVAL_MS){lastIdle=now;const x=.18+Math.random()*.64,y=.18+Math.random()*.64,a=Math.random()*Math.PI*2,m=18+Math.random()*35;interact(x,y,Math.cos(a)*m,Math.sin(a)*m,cfg.IDLE_FORCE);}advect(velocity.read,velocity.read,velocity.write,cfg.VELOCITY_DISSIPATION,dt*60);velocity.swap();div();solve();gradient();advect(dye.read,velocity.read,dye.write,cfg.DYE_DISSIPATION,dt*60);dye.swap();render();requestAnimationFrame(frame)}
  resize(); [velocity.read,velocity.write,dye.read,dye.write,pressure.read,pressure.write,divergence].forEach(clear); setTimeout(()=>{interact(.38,.52,36,8,.75);interact(.62,.48,-28,-6,.65)},100); requestAnimationFrame(frame);
})();
