import { createCanvas, loadImage } from '@napi-rs/canvas';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data: d, price, images } = req.body;
    const W = 800;

    // 색상
    const BG     = '#ffffff';
    const BLACK  = '#0f0f0f';
    const GRAY   = '#646464';
    const LGRAY  = '#d2d2d2';
    const IVORY  = '#f8f7f4';
    const LINE   = '#e1e1e1';
    const DARK   = '#161616';
    const GOLD   = '#c8a050';
    const YELLOW = '#ffc800';

    // 섹션 높이
    const heroH   = 110;
    const copyH   = 190;
    const ptH     = 270;
    const descH   = 360;
    const specH   = 320;
    const kwH     = 120;
    const cautH   = 200;
    const footH   = 90;

    // 사진 높이 계산
    let photoHeights = [];
    let loadedImgs = [];
    for (let i = 0; i < Math.min(images.length, 3); i++) {
      try {
        const buf = Buffer.from(images[i].split(',')[1], 'base64');
        const img = await loadImage(buf);
        const h = Math.round(img.height * (W / img.width));
        loadedImgs.push({ img, h });
        photoHeights.push(h);
      } catch(e) {
        loadedImgs.push(null);
        photoHeights.push(0);
      }
    }

    // 메인사진(첫번째 전폭) + 나머지 2장 나란히
    const mainH   = photoHeights[0] || 0;
    const colorH  = Math.max(photoHeights[1]||0, photoHeights[2]||0);
    const lbl2H   = loadedImgs.slice(1).some(Boolean) ? 40 : 0;

    const total = heroH + mainH + copyH + ptH + descH +
                  (lbl2H > 0 ? lbl2H + colorH : 0) +
                  specH + kwH + cautH + footH;

    const canvas = createCanvas(W, total);
    const ctx = canvas.getContext('2d');

    // 한국어 폰트 fallback
    const fontR = 'sans-serif';
    const fontB = 'bold sans-serif';

    function fillRect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    }
    function text(str, x, y, color, size, bold=false) {
      ctx.fillStyle = color;
      ctx.font = `${bold?'700 ':''} ${size}px ${bold?fontB:fontR}`;
      ctx.fillText(str, x, y);
    }
    function centerText(str, y, color, size, bold=false) {
      ctx.fillStyle = color;
      ctx.font = `${bold?'700 ':''} ${size}px ${bold?fontB:fontR}`;
      const w2 = ctx.measureText(str).width;
      ctx.fillText(str, (W - w2) / 2, y);
    }
    function line(x1, y1, x2, y2, color, lw=1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    function wrapText(str, x, y, maxW, size, color, lhAdd=8, bold=false) {
      ctx.fillStyle = color;
      ctx.font = `${bold?'700 ':''} ${size}px ${bold?fontB:fontR}`;
      const lh = size + lhAdd;
      let cur = '';
      let cy = y;
      for (const ch of str) {
        const test = cur + ch;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(cur, x, cy);
          cy += lh; cur = ch;
        } else cur = test;
      }
      if (cur) { ctx.fillText(cur, x, cy); cy += lh; }
      return cy;
    }

    let y = 0;

    // ── 1. 헤더 ──
    fillRect(0, y, W, heroH, DARK);
    const bt = 'NATIONAL GEOGRAPHIC STYLE  ·  FASHION & ACCESSORY';
    centerText(bt, y+24, YELLOW, 10);
    const ti = d.product_name || '상품 상세페이지';
    centerText(ti.length > 18 ? ti.slice(0,18)+'...' : ti, y+58, '#ffffff', 24, true);
    const su = d.subtitle || '';
    centerText(su, y+86, LGRAY, 13);
    y += heroH;

    // ── 2. 메인 사진 ──
    if (loadedImgs[0]?.img && mainH > 0) {
      ctx.drawImage(loadedImgs[0].img, 0, y, W, mainH);
      y += mainH;
    }

    // ── 3. 메인 카피 ──
    fillRect(0, y, W, copyH, IVORY);
    line(60, y+36, 100, y+36, GOLD, 2);
    text('MAIN COPY', 108, y+31, GOLD, 10);
    let cy = y+60;
    const copyLines = (d.main_copy||'').split('\n');
    for (const cl of copyLines) {
      cy = wrapText(cl, 60, cy, W-120, 18, BLACK, 8, true);
    }
    y += copyH;

    // ── 4. 판매 포인트 ──
    fillRect(0, y, W, ptH, BG);
    line(60, y+28, 100, y+28, GOLD, 2);
    text('SELLING POINTS', 108, y+23, GOLD, 10);
    const pts = d.selling_points || [];
    const colW = (W-80)/3;
    const px = y+60;
    for (let i=0; i<3; i++) {
      const cx = 40 + i*(colW+10);
      ctx.fillStyle = LGRAY; ctx.font = `700 28px ${fontB}`;
      ctx.fillText(`0${i+1}`, cx, px+42);
      line(cx, px+48, cx+colW-10, px+48, LINE);
      ctx.fillStyle = BLACK; ctx.font = `700 12px ${fontB}`;
      ctx.fillText((pts[i]||'').slice(0,10), cx, px+64);
      if (pts[i]) wrapText(pts[i], cx, px+82, colW-10, 11, GRAY, 6);
    }
    y += ptH;

    // ── 5. 상세 설명 ──
    fillRect(0, y, W, descH, IVORY);
    line(60, y+36, 100, y+36, GOLD, 2);
    text('PRODUCT STORY', 108, y+31, GOLD, 10);
    let dy = y+60;
    const paras = (d.description||'').split('\n').filter(Boolean);
    for (const para of paras) {
      dy = wrapText(para, 60, dy, W-120, 13, GRAY, 6);
      dy += 14;
    }
    y += descH;

    // ── 6. 컬러별 사진 나란히 ──
    if (lbl2H > 0) {
      fillRect(0, y, W, lbl2H, DARK);
      centerText('COLOR VARIATION  ·  컬러 선택', y+24, YELLOW, 10);
      y += lbl2H;

      if (loadedImgs[2]?.img) ctx.drawImage(loadedImgs[2].img, 0,      y, W/2, colorH);
      if (loadedImgs[1]?.img) ctx.drawImage(loadedImgs[1].img, W/2,    y, W/2, colorH);
      // 라벨
      fillRect(0,    y+colorH-30, W/2, 30, 'rgba(20,20,20,0.85)');
      fillRect(W/2,  y+colorH-30, W/2, 30, 'rgba(240,240,240,0.85)');
      centerText('● COLOR 1', y+colorH-14, '#ffffff', 10);
      line(W/2, y, W/2, y+colorH, '#b0b0b0');
      y += colorH;
    }

    // ── 7. 스펙 표 ──
    fillRect(0, y, W, specH, BG);
    line(60, y+36, 100, y+36, GOLD, 2);
    text('SPECIFICATION', 108, y+31, GOLD, 10);
    const specs = d.specs || [];
    let sy = y+60;
    for (const s of specs) {
      line(60, sy+30, W-60, sy+30, LINE);
      ctx.fillStyle = BLACK; ctx.font = `700 12px ${fontB}`;
      ctx.fillText(s.key, 70, sy+20);
      ctx.fillStyle = GRAY; ctx.font = `12px ${fontR}`;
      ctx.fillText(s.value, 220, sy+20);
      sy += 31;
    }
    y += specH;

    // ── 8. 키워드 ──
    fillRect(0, y, W, kwH, IVORY);
    line(60, y+28, 100, y+28, GOLD, 2);
    text('SEARCH KEYWORDS', 108, y+23, GOLD, 10);
    const kws = d.keywords || [];
    let kx = 60, ky = y+50;
    for (const kw of kws) {
      ctx.font = `11px ${fontR}`;
      const kw2 = '#'+kw;
      const kw_w = ctx.measureText(kw2).width + 18;
      if (kx + kw_w > W-60) { kx=60; ky+=32; }
      ctx.strokeStyle = DARK; ctx.lineWidth=1;
      ctx.strokeRect(kx, ky, kw_w, 26);
      ctx.fillStyle = DARK;
      ctx.fillText(kw2, kx+9, ky+17);
      kx += kw_w+8;
    }
    y += kwH;

    // ── 9. 주의사항 ──
    fillRect(0, y, W, cautH, BG);
    line(60, y+36, 100, y+36, GOLD, 2);
    text('CAUTION', 108, y+31, GOLD, 10);
    const cauts = (d.caution||'').split(/[.。]/).filter(c=>c.trim().length>2).slice(0,3);
    let ccy = y+58;
    for (const c of cauts) {
      ctx.fillStyle = GRAY; ctx.beginPath();
      ctx.arc(64, ccy+7, 4, 0, Math.PI*2); ctx.fill();
      ccy = wrapText(c.trim()+'.', 78, ccy, W-138, 12, GRAY, 6);
      ccy += 10;
    }
    y += cautH;

    // ── 10. 푸터 ──
    fillRect(0, y, W, footH, DARK);
    const priceNum = price ? parseInt(price.replace(/[^0-9]/g,''),10) : 0;
    if (priceNum) {
      centerText(`${priceNum.toLocaleString()}원`, y+38, YELLOW, 22, true);
      centerText('PageCraft Pro로 제작된 상세페이지', y+64, '#555568', 10);
    } else {
      centerText('PageCraft Pro  ·  AI 상세페이지 생성기', y+44, YELLOW, 13, true);
      centerText('Made with PageCraft Pro', y+68, '#555568', 10);
    }

    // PNG 출력
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="detail-page.png"');
    return res.status(200).send(buffer);

  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
