/**
 * PMC Viz3D — Three.js 3D visualizations
 * Provides: SACO 3D PDF Surface, Probability Sphere, Hypercube 3D
 * Depends on: THREE r134 + THREE.OrbitControls
 * Reads from: window.pmcState (exposed by app.js init)
 */
(function () {
  'use strict';

  // ── State adapter: maps WP state → Plot.html-compatible format ─────────────
  function getWPS() {
    var wp = window.pmcState;
    if (!wp) return null;
    var so = wp.seriesOn || {};
    var pm = so.adaptive ? 'adaptive' : so.fixed ? 'fixed' : so.manual ? 'manual' : null;
    return {
      basePdf:       wp.basePdf  || [],
      adjPdf:        wp.manPdf   || [],
      optPdfAdaptive:wp.adpPdf   || [],
      optPdfFixed:   wp.fixPdf   || [],
      baseCdf:       wp.baseCdf  || [],
      target:        wp.target,
      baselineProb:  wp.baseProb,
      adaptiveProb:  wp.adpProb,
      optimizedProb: wp.fixProb,
      adjustedProb:  wp.manProb,
      sliders:       wp.sliders  || {},
      O: wp.O, M: wp.M, P: wp.P,
      overlay: {
        adaptiveOn:  !!so.adaptive,
        fixedOn:     !!so.fixed,
        manualOn:    !!so.manual,
        primaryMode: pm,
        probeLevel:  5
      }
    };
  }

  // ── Shared math utilities ─────────────────────────────────────────────────
  function interpY(pts, x) {
    if (!pts || pts.length < 2 || x == null) return null;
    if (x <= pts[0].x) return pts[0].y;
    var n = pts.length;
    if (x >= pts[n-1].x) return pts[n-1].y;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo+hi)>>1; pts[m].x <= x ? lo=m : hi=m; }
    var p0=pts[lo], p1=pts[hi];
    var t = (x-p0.x)/(p1.x-p0.x||1e-10);
    return p0.y + t*(p1.y-p0.y);
  }

  function trapNorm(pts) {
    if (!pts || pts.length < 2) return pts;
    var area = 0;
    for (var i = 0; i < pts.length - 1; i++)
      area += (pts[i+1].x - pts[i].x) * (pts[i].y + pts[i+1].y) * 0.5;
    if (!(area > 1e-12)) return pts;
    return pts.map(function(p){ return { x: p.x, y: Math.max(0, p.y/area) }; });
  }

  function trapCDF(pdfPts, tau) {
    if (!pdfPts || pdfPts.length < 2 || tau == null) return null;
    var area = 0;
    for (var i = 0; i < pdfPts.length - 1; i++) {
      var x0=pdfPts[i].x, x1=pdfPts[i+1].x, y0=pdfPts[i].y, y1=pdfPts[i+1].y;
      if (x1 <= tau) { area += (x1-x0)*(y0+y1)*0.5; }
      else if (x0 < tau) {
        var t=(tau-x0)/(x1-x0), yT=y0+t*(y1-y0);
        area += (tau-x0)*(y0+yT)*0.5; break;
      } else break;
    }
    return Math.max(0, Math.min(1, area));
  }

  function hexToRgba(hex, alpha) {
    var r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
    return 'rgba('+r+','+g+','+b+','+(alpha||1)+')';
  }

  function makeTextSprite(text, opts) {
    opts = opts || {};
    var cw = (opts.w || 200) * 2, ch = (opts.h || 48) * 2;
    var canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext('2d');
    if (opts.bgColor && opts.bgColor !== 'transparent') {
      ctx.fillStyle = opts.bgColor;
      ctx.fillRect(2, 2, cw-4, ch-4);
    }
    ctx.font = (opts.bold ? 'bold ' : '') + ((opts.size || 13) * 2) + 'px Arial,sans-serif';
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cw/2, ch/2);
    var tex = new THREE.CanvasTexture(canvas);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(opts.sx || 2.2, opts.sy || 0.55, 1);
    return spr;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SACO 3D SURFACE
  // ═══════════════════════════════════════════════════════════════════════════
  var S3D = (function () {
    var _scene=null, _renderer=null, _camera=null, _controls=null;
    var _ribbonGroup=null, _tauGroup=null, _heptGroup=null;
    var _anim=null, _initialized=false, _lastW=0, _lastH=0;
    var D=4.0, YSCALE=5.0;
    var SLIDER_KEYS=['budgetFlexibility','scheduleFlexibility','scopeCertainty','scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'];
    var SLIDER_COLORS=[0xf59e0b,0x3b82f6,0x10b981,0x8b5cf6,0xef4444,0x06b6d4,0xf97316];
    var SLIDER_SHORT=['Budget','Schedule','Scope Cert','Scope Red','Rework','Risk','Conf'];
    var SLIDER_CSS=['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#06b6d4','#f97316'];

    function _clearGroup(g) {
      if (g && _scene) {
        _scene.remove(g);
        g.traverse(function(o){
          if (o.geometry) o.geometry.dispose();
          if (o.material) { if (Array.isArray(o.material)) o.material.forEach(function(m){m.dispose();}); else o.material.dispose(); }
        });
      }
      return null;
    }

    function _initThree(container) {
      if (_initialized) return;
      container.innerHTML = '';
      var cw = container.clientWidth || 600, ch = container.clientHeight || 320;
      _scene = new THREE.Scene();
      _scene.background = new THREE.Color(0x0e1118);
      _scene.fog = new THREE.Fog(0x0e1118, 20, 38);

      _camera = new THREE.PerspectiveCamera(42, cw/ch, 0.1, 100);
      _camera.position.set(6, 4.5, 8);
      _camera.lookAt(3.5, 0.8, D/2);

      _renderer = new THREE.WebGLRenderer({ antialias: true });
      _renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
      _renderer.setSize(cw, ch);
      _renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;border-radius:6px;';
      container.style.position = 'relative';
      container.appendChild(_renderer.domElement);

      // Floor grid
      var gMat = new THREE.LineBasicMaterial({ color: 0x1e2535, transparent: true, opacity: 0.7 });
      var gridG = new THREE.Group();
      for (var xi=0; xi<=12; xi++) { var xg=xi*0.6; gridG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xg,0,0),new THREE.Vector3(xg,0,D)]),gMat.clone())); }
      for (var zi=0; zi<=8; zi++) { var zg=zi*(D/8); gridG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,zg),new THREE.Vector3(7.2,0,zg)]),gMat.clone())); }
      _scene.add(gridG);

      _scene.add(new THREE.AmbientLight(0x8090b8, 0.8));
      var dl = new THREE.DirectionalLight(0xc8d4ff, 0.6); dl.position.set(4,8,6); _scene.add(dl);

      if (typeof THREE.OrbitControls !== 'undefined') {
        _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
        _controls.enableDamping = true; _controls.dampingFactor = 0.08;
        _controls.enableZoom = false; _controls.enablePan = false;
        _controls.autoRotate = false;
        _controls.target.set(3.5, 0.8, D/2);
        _controls.update();
      }
      _initialized = true;
      _startLoop();
    }

    function _startLoop() {
      if (_anim) return;
      function loop() {
        _anim = requestAnimationFrame(loop);
        if (_controls) _controls.update();
        if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
      }
      loop();
    }

    function _buildRibbon(pts, zPos, color, opacity) {
      var g = new THREE.Group();
      if (!pts || pts.length < 2) return g;
      var verts=[], idxs=[];
      for (var i=0;i<pts.length;i++) {
        verts.push(pts[i].x, 0, zPos);
        verts.push(pts[i].x, pts[i].y * YSCALE, zPos);
      }
      for (var j=0;j<pts.length-1;j++) {
        var b0=j*2,b1=b0+2,t0=b0+1,t1=b1+1;
        idxs.push(b0,b1,t0, b1,t1,t0);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idxs);
      geo.computeVertexNormals();
      var mat = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.1 });
      g.add(new THREE.Mesh(geo, mat));
      var linePts = pts.map(function(p){ return new THREE.Vector3(p.x, p.y*YSCALE, zPos); });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.85 })));
      return g;
    }

    function _updateRibbons(basePdfN, curPdfN, tau, F0, Fcur, stratHex, nonPrimStrats, sourceLabel) {
      _ribbonGroup = _clearGroup(_ribbonGroup);
      _tauGroup    = _clearGroup(_tauGroup);
      _ribbonGroup = new THREE.Group();
      _tauGroup    = new THREE.Group();

      if (!basePdfN || basePdfN.length < 2) { _scene.add(_ribbonGroup); _scene.add(_tauGroup); return; }

      var xMin=basePdfN[0].x, xMax=basePdfN[basePdfN.length-1].x, xRange=xMax-xMin||1;
      function normX(x){ return (x-xMin)/xRange*7; }
      var yMax3 = Math.max.apply(null, basePdfN.map(function(p){return p.y;}));
      if (curPdfN) { var cMax=Math.max.apply(null,curPdfN.map(function(p){return p.y;})); if(cMax>yMax3) yMax3=cMax; }
      if (yMax3 < 1e-12) yMax3 = 1;

      var baseMapped = basePdfN.map(function(p){ return {x:normX(p.x), y:p.y/yMax3}; });
      _ribbonGroup.add(_buildRibbon(baseMapped, D/2, 0x7090b8, 0.55));

      if (curPdfN) {
        var curRS = basePdfN.map(function(p){ return {x:normX(p.x), y:Math.max(0,interpY(curPdfN,p.x))/yMax3}; });
        _ribbonGroup.add(_buildRibbon(curRS, D*0.12, stratHex, 0.65));
      }

      if (nonPrimStrats && nonPrimStrats.length) {
        nonPrimStrats.forEach(function(os, idx){
          var nps=nonPrimStrats.length;
          var zOff = nps===1 ? D*0.85 : D*(0.75+idx*0.2/Math.max(1,nps-1));
          var osRS = basePdfN.map(function(p){ return {x:normX(p.x), y:Math.max(0,interpY(os.pdfN,p.x))/yMax3}; });
          _ribbonGroup.add(_buildRibbon(osRS, zOff, os.hex, 0.38));
        });
      }

      // τ-plane
      if (tau != null && isFinite(tau)) {
        var xTau = normX(tau);
        if (xTau >= -0.5 && xTau <= 7.5) {
          var tauPts = [new THREE.Vector3(xTau,0,0),new THREE.Vector3(xTau,YSCALE,0),new THREE.Vector3(xTau,YSCALE,D),new THREE.Vector3(xTau,0,D),new THREE.Vector3(xTau,0,0)];
          _tauGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tauPts), new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 })));
          var tSpr = makeTextSprite('τ = '+tau.toFixed(2), { color:'#fbbf24', bold:true, size:12, w:140, h:36, bgColor:'rgba(20,24,40,0.82)' });
          tSpr.position.set(xTau, YSCALE+0.32, D/2);
          _tauGroup.add(tSpr);
          if (F0 != null) {
            var yB = F0*YSCALE;
            _tauGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xTau,0,D/2),new THREE.Vector3(xTau,yB,D/2)]), new THREE.LineBasicMaterial({ color:0x7090b8 })));
            var bSpr = makeTextSprite('Base '+(F0*100).toFixed(1)+'%', { color:'#90b8e0', bold:true, size:11, w:124, h:32, bgColor:'rgba(10,12,20,0.78)' });
            bSpr.position.set(xTau-0.55, yB+0.28, D/2); _tauGroup.add(bSpr);
          }
          if (Fcur != null && curPdfN) {
            var yS = Fcur*YSCALE;
            _tauGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xTau,0,D*0.12),new THREE.Vector3(xTau,yS,D*0.12)]), new THREE.LineBasicMaterial({ color:stratHex })));
            var sSpr = makeTextSprite((sourceLabel||'Strategy')+' '+(Fcur*100).toFixed(1)+'%', { color:hexToRgba(stratHex,1), bold:true, size:11, w:164, h:32, bgColor:'rgba(10,12,20,0.78)' });
            sSpr.position.set(xTau+0.55, yS+0.28, D*0.12); _tauGroup.add(sSpr);
          }
        }
      }
      _scene.add(_ribbonGroup);
      _scene.add(_tauGroup);
    }

    function _updateHeptagon(sliders) {
      _heptGroup = _clearGroup(_heptGroup);
      _heptGroup = new THREE.Group();
      var N=7, R_MAX=2.3, Y_RING=-0.55;
      var vals = SLIDER_KEYS.map(function(k,i){ return Math.max(0,Math.min(i===4?50:100, sliders[k]||0))/(i===4?50:100); });
      var pts = vals.map(function(v,k){ var th=(2*Math.PI*k/N)-Math.PI/2; return new THREE.Vector3(R_MAX*v*Math.cos(th),Y_RING,R_MAX*v*Math.sin(th)+D/2); });
      var circPts=[]; for (var ci=0;ci<=72;ci++){var a=(2*Math.PI*ci/72)-Math.PI/2; circPts.push(new THREE.Vector3(R_MAX*Math.cos(a),Y_RING,R_MAX*Math.sin(a)+D/2));}
      _heptGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circPts), new THREE.LineBasicMaterial({color:0x90a8c8,transparent:true,opacity:0.5})));
      var ctr=new THREE.Vector3(0,Y_RING,D/2);
      for (var k=0;k<N;k++) {
        _heptGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([ctr.clone(),pts[k].clone()]), new THREE.LineBasicMaterial({color:0x8898b8,transparent:true,opacity:0.45})));
        _heptGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[k].clone(),pts[(k+1)%N].clone()]), new THREE.LineBasicMaterial({color:0x6888b8,transparent:true,opacity:0.65})));
        var dot=new THREE.Mesh(new THREE.SphereGeometry(0.09,10,10),new THREE.MeshBasicMaterial({color:SLIDER_COLORS[k]}));
        dot.position.copy(pts[k]); _heptGroup.add(dot);
        var th_k=(2*Math.PI*k/N)-Math.PI/2, pct_k=Math.round(vals[k]*100);
        var lsp=makeTextSprite(SLIDER_SHORT[k]+' '+pct_k+'%',{color:SLIDER_CSS[k],bold:false,size:11,w:104,h:30,sx:1.6,sy:0.42});
        var lR=R_MAX*1.26; lsp.position.set(lR*Math.cos(th_k),Y_RING+0.34,lR*Math.sin(th_k)+D/2); _heptGroup.add(lsp);
      }
      _scene.add(_heptGroup);
    }

    function render() {
      if (typeof THREE === 'undefined') return;
      var S = getWPS(); if (!S) return;
      var container = document.getElementById('pmc-saco3d-container');
      if (!container) return;
      if (!_initialized) _initThree(container);

      var cw=container.clientWidth, ch=container.clientHeight||320;
      if (_renderer && (Math.abs(cw-_lastW)>4 || Math.abs(ch-_lastH)>4)) {
        _renderer.setSize(cw,ch);
        if (_camera){ _camera.aspect=cw/ch; _camera.updateProjectionMatrix(); }
        _lastW=cw; _lastH=ch;
      }
      if (!_scene) return;

      var ov=S.overlay, pm3d=ov.primaryMode;
      var rawBase = S.basePdf && S.basePdf.length>1 ? S.basePdf : null;
      var rawCur=null, source='None', stratHex=0x3b82f6;
      if (pm3d==='adaptive' && ov.adaptiveOn && S.optPdfAdaptive && S.optPdfAdaptive.length>1) { rawCur=S.optPdfAdaptive; source='Conservative'; stratHex=0x8b5cf6; }
      else if (pm3d==='fixed' && ov.fixedOn && S.optPdfFixed && S.optPdfFixed.length>1) { rawCur=S.optPdfFixed; source='General Opt.'; stratHex=0x3b82f6; }
      else if (pm3d==='manual' && ov.manualOn && S.adjPdf && S.adjPdf.length>1) { rawCur=S.adjPdf; source='Unconstrained'; stratHex=0x10b981; }

      var basePdfN = rawBase ? trapNorm(rawBase) : null;
      var curPdfN = null;
      if (rawCur && rawCur.length>1 && basePdfN) {
        var rs = basePdfN.map(function(p){ return {x:p.x,y:Math.max(0,interpY(rawCur,p.x))}; });
        curPdfN = trapNorm(rs);
      }

      var tau = S.target!=null ? Number(S.target) : null;
      var F0   = basePdfN && tau!=null ? trapCDF(basePdfN, tau) : null;
      var Fcur = curPdfN  && tau!=null ? trapCDF(curPdfN,  tau) : F0;

      var nonPrimStrats=[];
      [{mode:'adaptive',rawPdf:S.optPdfAdaptive,hex:0x8b5cf6},{mode:'fixed',rawPdf:S.optPdfFixed,hex:0x3b82f6},{mode:'manual',rawPdf:S.adjPdf,hex:0x10b981}].forEach(function(sd){
        if (sd.mode===pm3d || !ov[sd.mode+'On'] || !sd.rawPdf || sd.rawPdf.length<2 || !basePdfN) return;
        var rsn=basePdfN.map(function(p){return{x:p.x,y:Math.max(0,interpY(sd.rawPdf,p.x))};});
        var pdfN=trapNorm(rsn); if(pdfN&&pdfN.length>1) nonPrimStrats.push({pdfN:pdfN,hex:sd.hex});
      });

      _updateRibbons(basePdfN, curPdfN, tau, F0, Fcur, stratHex, nonPrimStrats, source);
      _updateHeptagon(S.sliders);

      var hudEl = document.getElementById('pmc-saco3d-hud');
      if (hudEl) {
        var dP = (F0!=null&&Fcur!=null) ? (Fcur-F0)*100 : null;
        var col = dP!=null ? (dP>0.5?'#16A34A':dP<-0.5?'#DC2626':'#6B7280') : '#6B7280';
        hudEl.innerHTML =
          '<span>Baseline: <b>'+(F0!=null?(F0*100).toFixed(1)+'%':'–')+'</b></span>' +
          '<span style="margin-left:12px;">'+source+': <b>'+(Fcur!=null?(Fcur*100).toFixed(1)+'%':'–')+'</b></span>' +
          (dP!=null?'<span style="margin-left:12px;color:'+col+'">ΔP: <b>'+(dP>=0?'+':'')+dP.toFixed(1)+'%</b></span>':'');
      }
    }

    return { render: render };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  //  PROBABILITY SPHERE
  // ═══════════════════════════════════════════════════════════════════════════
  var SPHERE = (function () {
    var _sR=1.65, _sRen=null, _sScn=null, _sCam=null, _sCtl=null;
    var _sLastW=0, _sLastH=0;
    var _sFillBase=null, _sFills=[], _sRings=[];
    var _sAnim=null, _sInited=false;
    var _sCurH0=0, _sTgtH0=0;
    var _sFillCurH=[0,0,0], _sFillTgtH=[0,0,0];
    var EASE_S=0.09;
    var _sAnnDiv=null;

    function hToY(h){ return h - _sR; }

    function probToH3(P) {
      P=Math.max(0,Math.min(1,P||0));
      if (P===0) return 0; if (P>=1) return 2*_sR;
      var R=_sR, Vt=(4/3)*Math.PI*R*R*R, Vg=P*Vt, lo=0, hi=2*R;
      for (var i=0;i<52;i++){ var m=(lo+hi)/2; Math.PI*m*m*(3*R-m)/3<Vg?lo=m:hi=m; }
      return (lo+hi)/2;
    }

    function _initSphere(container) {
      if (_sInited) return;
      container.innerHTML = '';
      var w=container.clientWidth||260, h=container.clientHeight||260;

      _sScn=new THREE.Scene(); _sScn.background=new THREE.Color(0xF0F4FA);
      _sCam=new THREE.PerspectiveCamera(36,w/h,0.01,50);
      _sCam.position.set(0,0.6,5.6); _sCam.lookAt(0,0,0);

      _sRen=new THREE.WebGLRenderer({antialias:true});
      _sRen.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      _sRen.setSize(w,h); _sRen.localClippingEnabled=true;
      _sRen.domElement.style.cssText='display:block;width:100%;height:100%;border-radius:6px;';
      container.style.position='relative';
      container.appendChild(_sRen.domElement);

      _sScn.add(new THREE.AmbientLight(0xdce8f8,0.50));
      var kl=new THREE.DirectionalLight(0xfff8e8,0.80); kl.position.set(3,5,5); _sScn.add(kl);
      var fl=new THREE.DirectionalLight(0xc0d4ff,0.35); fl.position.set(-3,2,-3); _sScn.add(fl);

      // Glass outer sphere
      var sGeo=new THREE.SphereGeometry(_sR,48,48);
      _sScn.add(new THREE.Mesh(sGeo,new THREE.MeshPhysicalMaterial({color:0x90b8e0,transparent:true,opacity:0.18,roughness:0.05,metalness:0,clearcoat:1,clearcoatRoughness:0.08,side:THREE.FrontSide,depthWrite:false})));
      _sScn.add(new THREE.Mesh(new THREE.SphereGeometry(_sR*0.998,48,48),new THREE.MeshPhysicalMaterial({color:0x7090b8,transparent:true,opacity:0.06,roughness:0.05,metalness:0,side:THREE.BackSide,depthWrite:false})));

      // Baseline fill
      _sFillBase=new THREE.Mesh(new THREE.SphereGeometry(_sR*0.992,40,40),new THREE.MeshStandardMaterial({
        color:0x8898b8,transparent:true,opacity:0.65,roughness:0.60,metalness:0.05,
        clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,-1,0),-_sR)],side:THREE.FrontSide
      }));
      _sScn.add(_sFillBase);

      // Per-strategy fills
      [{col:0x8b5cf6,r:_sR*0.984},{col:0x3b82f6,r:_sR*0.974},{col:0x10b981,r:_sR*0.964}].forEach(function(fd){
        var f=new THREE.Mesh(new THREE.SphereGeometry(fd.r,40,40),new THREE.MeshStandardMaterial({
          color:fd.col,transparent:true,opacity:0,roughness:0.28,metalness:0.10,depthWrite:false,
          clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,-1,0),-_sR)],side:THREE.FrontSide
        }));
        _sScn.add(f); _sFills.push(f);
      });

      // Equator + meridian lines
      var eqPts=[];
      for (var i=0;i<=72;i++){var a=2*Math.PI*i/72; eqPts.push(new THREE.Vector3(_sR*Math.cos(a),0,_sR*Math.sin(a)));}
      _sScn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts),new THREE.LineBasicMaterial({color:0x7090b8,transparent:true,opacity:0.50})));
      [0,Math.PI/2.5,Math.PI/1.25].forEach(function(ay){
        var mPts=[];
        for (var j=0;j<=48;j++){var b=2*Math.PI*j/48; mPts.push(new THREE.Vector3(_sR*Math.sin(b)*Math.cos(ay),_sR*Math.cos(b),_sR*Math.sin(b)*Math.sin(ay)));}
        _sScn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mPts),new THREE.LineBasicMaterial({color:0x9ab0cc,transparent:true,opacity:0.35})));
      });

      // Waterline rings
      var _ringCircPts=[];
      for (var ri=0;ri<=80;ri++){var ra=2*Math.PI*ri/80; _ringCircPts.push(new THREE.Vector3(Math.cos(ra),0,Math.sin(ra)));}
      [0x8b5cf6,0x3b82f6,0x10b981].forEach(function(col){
        var ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(_ringCircPts),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.90}));
        ring.visible=false; _sScn.add(ring); _sRings.push(ring);
      });

      if (typeof THREE.OrbitControls !== 'undefined') {
        _sCtl=new THREE.OrbitControls(_sCam,_sRen.domElement);
        _sCtl.enableDamping=true; _sCtl.dampingFactor=0.08;
        _sCtl.minDistance=3; _sCtl.maxDistance=12;
        _sCtl.target.set(0,0,0); _sCtl.autoRotate=true; _sCtl.autoRotateSpeed=0.55;
        _sCtl.enableZoom=false; _sCtl.enablePan=false; _sCtl.update();
      }

      // Annotation overlay div
      var annDiv=document.createElement('div');
      annDiv.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:hidden;';
      container.appendChild(annDiv);
      _sAnnDiv=annDiv;

      _sInited=true;
      _startSphereLoop();
    }

    function _startSphereLoop() {
      if (_sAnim) return;
      function loop() {
        _sAnim=requestAnimationFrame(loop);
        _sCurH0+=(_sTgtH0-_sCurH0)*EASE_S;
        if (_sFillBase&&_sFillBase.material.clippingPlanes[0])
          _sFillBase.material.clippingPlanes[0].constant=hToY(_sCurH0);
        for (var fi=0;fi<_sFills.length;fi++) {
          _sFillCurH[fi]+=(_sFillTgtH[fi]-_sFillCurH[fi])*EASE_S;
          if (_sFills[fi]&&_sFills[fi].material.clippingPlanes[0])
            _sFills[fi].material.clippingPlanes[0].constant=hToY(_sFillCurH[fi]);
        }
        for (var ri=0;ri<_sRings.length;ri++) {
          if (!_sRings[ri].visible) continue;
          var ry=hToY(_sFillCurH[ri]), rr=Math.sqrt(Math.max(0.001,_sR*_sR-ry*ry));
          _sRings[ri].position.y=ry; _sRings[ri].scale.set(rr,1,rr);
        }
        if (_sCtl) _sCtl.update();
        if (_sRen&&_sScn&&_sCam) _sRen.render(_sScn,_sCam);
        _updateSphereAnnotations();
      }
      loop();
    }

    function _updateSphereAnnotations() {
      if (!_sCam||!_sRen||!_sAnnDiv) return;
      var S=getWPS(); if (!S) return;
      var ov=S.overlay, P0=S.baselineProb||0;
      var anyAct=ov.adaptiveOn||ov.fixedOn||ov.manualOn;
      var container=document.getElementById('pmc-sphere-container');
      if (!container) return;
      var sw=container.clientWidth||260, sh=container.clientHeight||260;

      _sAnnDiv.innerHTML='';
      if (!anyAct) return;

      var stratDefs=[
        {label:'Baseline',     prob:P0,              active:anyAct,         fillIdx:-1},
        {label:'Conservative', prob:S.adaptiveProb,  active:!!ov.adaptiveOn,fillIdx:0},
        {label:'General',      prob:S.optimizedProb, active:!!ov.fixedOn,   fillIdx:1},
        {label:'Unconstrained',prob:S.adjustedProb,  active:!!ov.manualOn,  fillIdx:2}
      ];
      var cols=['#374151','#5b21b6','#1e40af','#065f46'];
      var usedY=[];

      stratDefs.forEach(function(sd,si){
        if (!sd.active||sd.prob==null||!isFinite(sd.prob)) return;
        var fillH=sd.fillIdx===-1?_sCurH0:_sFillCurH[sd.fillIdx];
        var ringY=hToY(fillH);
        var ringR=Math.sqrt(Math.max(0.001,_sR*_sR-ringY*ringY));
        var worldPt=new THREE.Vector3(ringR,ringY,0);
        worldPt.project(_sCam);
        var sx=(worldPt.x+1)/2*sw;
        var sy=(1-worldPt.y)/2*sh;
        while (usedY.some(function(uy){return Math.abs(uy-sy)<22;})) sy+=22;
        usedY.push(sy);
        var dp=sd.fillIdx!==-1&&P0!=null?(sd.prob-P0)*100:null;
        var ann=document.createElement('div');
        ann.textContent=sd.label+' '+(sd.prob*100).toFixed(1)+'%'+(dp!=null?' (ΔP '+(dp>=0?'+':'')+dp.toFixed(1)+'%)':'');
        ann.style.cssText='position:absolute;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;white-space:nowrap;'+
          'color:'+cols[si]+';background:rgba(255,255,255,0.90);border:1px solid '+cols[si]+';'+
          'left:'+Math.round(sx)+'px;top:'+Math.round(sy-10)+'px;';
        _sAnnDiv.appendChild(ann);
      });
    }

    function render() {
      if (typeof THREE==='undefined') return;
      var S=getWPS(); if (!S) return;
      var container=document.getElementById('pmc-sphere-container');
      if (!container) return;
      if (!_sInited) _initSphere(container);

      var sw=container.clientWidth||260, sh=container.clientHeight||260;
      if (_sRen&&(Math.abs(sw-_sLastW)>4||Math.abs(sh-_sLastH)>4)){
        _sRen.setSize(sw,sh);
        if (_sCam){_sCam.aspect=sw/sh;_sCam.updateProjectionMatrix();}
        _sLastW=sw; _sLastH=sh;
      }

      var P0=S.baselineProb||0, ov=S.overlay;
      _sTgtH0=probToH3(P0);
      var _sProbs=[S.adaptiveProb,S.optimizedProb,S.adjustedProb];
      var _sOn=[ov.adaptiveOn,ov.fixedOn,ov.manualOn];
      for (var sfi=0;sfi<_sFills.length;sfi++){
        if (!_sFills[sfi]) continue;
        var sfOn=!!(_sOn[sfi]&&_sProbs[sfi]!=null&&isFinite(_sProbs[sfi]));
        _sFills[sfi].material.opacity=sfOn?0.62:0;
        _sFillTgtH[sfi]=sfOn?probToH3(_sProbs[sfi]):_sFillCurH[sfi];
        if (_sRings[sfi]) _sRings[sfi].visible=sfOn;
      }

      var pm=ov.primaryMode;
      var Pcur=pm==='adaptive'&&ov.adaptiveOn?(S.adaptiveProb||P0):pm==='fixed'&&ov.fixedOn?(S.optimizedProb||P0):pm==='manual'&&ov.manualOn?(S.adjustedProb||P0):P0;
      var hudEl=document.getElementById('pmc-sphere-hud');
      if (hudEl){
        var dP=Pcur-P0;
        var col=dP>0.005?'#16A34A':dP<-0.005?'#DC2626':'#6B7280';
        hudEl.innerHTML='<span>Baseline: <b>'+(P0*100).toFixed(2)+'%</b></span>'+
          '<span style="margin-left:12px;">Strategy: <b>'+(Pcur*100).toFixed(2)+'%</b></span>'+
          '<span style="margin-left:12px;color:'+col+'">ΔP: <b>'+(dP>=0?'+':'')+(dP*100).toFixed(2)+'%</b></span>';
      }
    }

    return { render: render };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  //  HYPERCUBE 3D
  // ═══════════════════════════════════════════════════════════════════════════
  var HYP = (function () {
    var SLIDER_KEYS=['budgetFlexibility','scheduleFlexibility','scopeCertainty','scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'];
    var SLIDER_LABELS=['Budget Flex','Schedule Flex','Scope Cert','Scope Red','Rework','Risk Tol','Confidence'];

    function render() {
      if (typeof THREE==='undefined') return;
      var S=getWPS(); if (!S) return;
      var canvas3D=document.getElementById('pmc-hypercube3d-canvas');
      if (!canvas3D) return;

      // Dispose previous renderer
      if (window._pmcHypRen){window._pmcHypRen.dispose();window._pmcHypRen=null;}
      if (window._pmcHypAnId){cancelAnimationFrame(window._pmcHypAnId);window._pmcHypAnId=null;}
      if (window._pmcHypResCb){window.removeEventListener('resize',window._pmcHypResCb);window._pmcHypResCb=null;}

      var cw=canvas3D.clientWidth||500, ch=canvas3D.clientHeight||300;
      var scene=new THREE.Scene(); scene.background=new THREE.Color(0xf8f9fa);
      var camera=new THREE.PerspectiveCamera(60,cw/Math.max(ch,1),0.1,1000);
      var renderer=new THREE.WebGLRenderer({canvas:canvas3D,antialias:true});
      renderer.setSize(cw,ch); renderer.setPixelRatio(window.devicePixelRatio||1);
      window._pmcHypRen=renderer;
      scene.add(new THREE.AmbientLight(0xffffff,1));

      var sliderVals=SLIDER_KEYS.map(function(k,i){ return Math.max(0,Math.min(i===4?50:100,S.sliders[k]||0))/(i===4?50:100); });
      var angles=sliderVals.map(function(v){return v*Math.PI*2;});

      var O=S.O||0, Mval=S.M||50, P=S.P||100;
      var baselineValues=[(Mval/Math.max(P,1)), Math.abs(P-O)/Math.max(P,100)*0.5, S.baselineProb||0.5];

      // 4D hypercube
      var vertices4D=[];
      for (var i=0;i<16;i++) vertices4D.push([(i&1?1:-1),(i&2?1:-1),(i&4?1:-1),(i&8?1:-1)]);
      var edges=[];
      for (var ei=0;ei<16;ei++) for (var ej=ei+1;ej<16;ej++){var diff=ei^ej; if(diff&&!(diff&(diff-1))) edges.push([ei,ej]);}

      var group=new THREE.Group(); scene.add(group);
      var mat=new THREE.LineBasicMaterial({color:0x0066ff});

      function updateHypercube(){
        group.clear();
        var projected=vertices4D.map(function(v){
          var x=v[0],y=v[1],z=v[2],w=v[3],tmp;
          for (var p=0;p<6;p++){
            var th=angles[p],c=Math.cos(th),s=Math.sin(th);
            if(p===0){tmp=x*c-y*s;y=x*s+y*c;x=tmp;}
            else if(p===1){tmp=x*c-z*s;z=x*s+z*c;x=tmp;}
            else if(p===2){tmp=x*c-w*s;w=x*s+w*c;x=tmp;}
            else if(p===3){tmp=y*c-z*s;z=y*s+z*c;y=tmp;}
            else if(p===4){tmp=y*c-w*s;w=y*s+w*c;y=tmp;}
            else{tmp=z*c-w*s;w=z*s+w*c;z=tmp;}
          }
          x*=(1+baselineValues[0]); y*=(1+baselineValues[1]); z*=(1+baselineValues[2]);
          var dist=4,scale=dist/(dist+w);
          return new THREE.Vector3(x*scale,y*scale,z*scale);
        });
        edges.forEach(function(e){
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([projected[e[0]],projected[e[1]]]),mat));
        });
        // Slider labels
        SLIDER_LABELS.forEach(function(lbl,li){
          var pos=new THREE.Vector3((li%3-1)*4.5,(Math.floor(li/3)-0.5)*3.2,-2);
          var spr=makeTextSprite(lbl+': '+(sliderVals[li]*100).toFixed(0)+'%',{size:13,w:196,h:46,color:'#374151',bgColor:'rgba(248,249,250,0.92)'});
          spr.scale.set(2.8,0.65,1); spr.position.copy(pos); group.add(spr);
        });
        var bestProb=Math.max(S.baselineProb||0,S.adaptiveProb||0,S.optimizedProb||0,S.adjustedProb||0);
        var pSpr=makeTextSprite('Best P(≤τ) = '+(bestProb*100).toFixed(1)+'%',{size:15,w:220,h:50,color:'#1e40af',bold:true,bgColor:'rgba(239,246,255,0.94)'});
        pSpr.scale.set(3.2,0.72,1); pSpr.position.set(0,-4.2,0); group.add(pSpr);
      }

      updateHypercube();
      scene.add(new THREE.AxesHelper(4));
      camera.position.z=10;

      if (typeof THREE.OrbitControls !== 'undefined') {
        var controls=new THREE.OrbitControls(camera,renderer.domElement);
        controls.enableDamping=false;
        window._pmcHypControls=controls;
        var renderOnce=function(){ renderer.render(scene,camera); };
        renderOnce();
        controls.addEventListener('change',renderOnce);

        window._pmcHypResCb=function(){
          if (!canvas3D.offsetParent) return;
          var nw=canvas3D.clientWidth, nh=canvas3D.clientHeight||300;
          camera.aspect=nw/Math.max(nh,1); camera.updateProjectionMatrix();
          renderer.setSize(nw,nh); renderOnce();
        };
        window.addEventListener('resize',window._pmcHypResCb,{passive:true});
      } else {
        renderer.render(scene,camera);
      }

      var sub=document.getElementById('pmc-hypercube3d-subtitle');
      if (sub) sub.textContent='Target τ = '+(S.target!=null?Number(S.target).toFixed(2):'N/A')+
        '  ·  Best P(≤τ) = '+((Math.max(S.baselineProb||0,S.adaptiveProb||0,S.optimizedProb||0,S.adjustedProb||0)*100).toFixed(1))+'%';
    }

    return { render: render };
  })();

  // ── Public API ─────────────────────────────────────────────────────────────
  window.PMCViz3D = {
    renderSaco3D:   S3D.render,
    renderSphere:   SPHERE.render,
    renderHypercube:HYP.render
  };

})();
