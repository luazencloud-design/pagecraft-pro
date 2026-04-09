// ── AI 모델 이미지 생성 ──
// gemini-2.5-flash-image 모델로 상품 착용 모델 이미지 생성
// 월 100개 제한 (인메모리 카운터 — Vercel 서버리스에서는 cold start마다 리셋됨)
// ⚠️ 프로덕션에서는 KV/DB 기반 카운터로 교체 필요

let monthlyCount = { month: new Date().getMonth(), count: 0 };

function checkMonthlyLimit() {
  const now = new Date().getMonth();
  if (monthlyCount.month !== now) {
    monthlyCount = { month: now, count: 0 };
  }
  return monthlyCount.count < 100;
}

// ── 카테고리별 촬영 포커스 결정 ──
function getCameraFocus(category, productName) {
  const name = (productName || '').toLowerCase();
  const cat = (category || '').toLowerCase();

  // 1) 상품명에서 구체적 아이템 감지
  if (/모자|캡|비니|버킷햇|햇|헤어밴드|머리띠/.test(name)) return { part: 'head only', shot: 'tight close-up of the head from top of hat to chin, showing ONLY the head and the accessory. No shoulders, no body.', crop: 'top of accessory to chin only' };
  if (/귀걸이|이어링/.test(name)) return { part: 'head only', shot: 'close-up of the head and ears only, no shoulders visible. Focus on the earrings.', crop: 'top of head to chin' };
  if (/안경|선글라스/.test(name)) return { part: 'head only', shot: 'close-up of the face only, showing the eyewear clearly. No body below chin.', crop: 'forehead to chin' };
  if (/목걸이|네크리스|펜던트/.test(name)) return { part: 'head and neck', shot: 'portrait from head to mid-chest showing the necklace on the neckline', crop: 'head to mid-chest' };
  if (/스카프|머플러|넥워머/.test(name)) return { part: 'head and neck', shot: 'portrait from head to chest showing how the scarf is wrapped', crop: 'head to chest' };
  if (/팔찌|뱅글|시계|손목/.test(name)) return { part: 'wrist', shot: 'close-up of the wrist and hand area only', crop: 'elbow to fingertips' };
  if (/반지|링/.test(name)) return { part: 'hand', shot: 'extreme close-up of the hand showcasing the ring', crop: 'hand and fingers only' };
  if (/벨트/.test(name)) return { part: 'waist', shot: 'mid-body shot focusing on the waist area', crop: 'chest to thighs' };
  if (/양말|삭스/.test(name)) return { part: 'feet', shot: 'model sitting on a white stool/chair with legs crossed, low-angle shot focusing on the feet and ankles.', crop: 'knees to feet' };

  // 2) 카테고리 기반
  if (/패딩|점퍼|집업|후리스|후리|티셔츠|맨투맨|상의|자켓|코트|셔츠|블라우스|니트|가디건|조끼/.test(cat)) {
    return { part: 'head and torso', shot: 'upper body portrait showing ONLY head and torso. Crop below the waist — no legs visible.', crop: 'top of head to waist, no legs' };
  }
  if (/바지|하의|팬츠|스커트|치마|레깅스|청바지|슬랙스/.test(cat)) {
    return { part: 'lower body', shot: 'full body shot with emphasis on the lower half, standing pose showing pants/skirt details clearly', crop: 'waist to feet' };
  }
  if (/가방|배낭|백팩|토트|크로스백|숄더백/.test(cat)) {
    return { part: 'head and torso with bag', shot: 'upper body or 3/4 body shot showing ONLY head, torso, and the bag. Show head and body only.', crop: 'head to hips, showing bag' };
  }
  if (/모자|캡|비니|버킷햇|햇/.test(cat)) {
    return { part: 'head only', shot: 'tight close-up of the head showing ONLY the head with the hat. No shoulders, no body below chin.', crop: 'top of hat to chin only' };
  }
  if (/신발|부츠|스니커즈|운동화|로퍼|구두/.test(cat)) {
    return { part: 'feet and legs seated', shot: 'model sitting casually on a white stool/chair with one leg crossed over the other, camera at low angle focusing on the footwear. The shoes must be the CENTER and largest element.', crop: 'seated pose, thighs to feet' };
  }
  if (/슬리퍼|샌들|쪼리/.test(cat)) {
    return { part: 'feet seated', shot: 'model sitting on a white stool with feet forward, close-up focusing on the sandals/slippers.', crop: 'knees to feet, seated' };
  }
  if (/스카프|머플러|넥워머/.test(cat)) {
    return { part: 'head and neck', shot: 'portrait from head to chest showing how the scarf is styled', crop: 'head to chest' };
  }
  if (/액세서리/.test(cat)) {
    return { part: 'accessory focus', shot: 'close-up showing ONLY the body part where the accessory is worn.', crop: 'tight on accessory' };
  }

  return { part: 'full body', shot: 'full body shot showing the complete outfit', crop: 'head to toe' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: 남은 횟수 조회 (테스트/디버그용)
  if (req.method === 'GET') {
    checkMonthlyLimit();
    return res.status(200).json({
      remaining: 100 - monthlyCount.count,
      used: monthlyCount.count,
      limit: 100,
      currentMonth: monthlyCount.month,
      note: '⚠️ 인메모리 카운터: Vercel cold start 시 리셋됨. 프로덕션에서는 KV/DB 사용 권장.'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  if (!checkMonthlyLimit()) {
    return res.status(429).json({
      error: '이번 달 AI 모델 이미지 생성 한도(100개)를 초과했습니다.',
      remaining: 0, used: monthlyCount.count, limit: 100
    });
  }

  // ── 테스트용: _testCount 파라미터로 카운터 강제 설정 ──
  if (req.body._testCount !== undefined) {
    monthlyCount.count = parseInt(req.body._testCount, 10) || 0;
    return res.status(200).json({
      message: `테스트: 카운터를 ${monthlyCount.count}로 설정했습니다.`,
      remaining: 100 - monthlyCount.count, used: monthlyCount.count, limit: 100
    });
  }

  try {
    const { productName, category, gender, productImages } = req.body;

    if (!productName && !category) {
      return res.status(400).json({ error: '상품명 또는 카테고리가 필요합니다.' });
    }

    const genderEn = gender === 'male' ? 'male' : 'female';
    const focus = getCameraFocus(category, productName);

    const prompt = `You are a professional Korean e-commerce product photographer.

CREATE a photorealistic studio photograph with these EXACT specifications:

SUBJECT: A Korean ${genderEn} model in their late 20s wearing/using "${productName || category}"

CAMERA & COMPOSITION:
- ${focus.shot}
- Crop: ${focus.crop}
- The product MUST be positioned at the CENTER of the image frame
- The product on the ${focus.part} must be the visual focal point of the image
- Use shallow depth of field to draw attention to the product area
- Center the product both horizontally and vertically in the composition

IMPORTANT — PRODUCT vs CATEGORY CONFLICT:
- If the reference images show a product that does NOT match the category "${category}", ALWAYS follow what the reference images show.
- For example: if category says "모자" but the image shows a jacket, photograph the model wearing the jacket (upper body focus).

STYLING:
- Clean white or light gray studio background
- Professional studio lighting (soft key light + fill light + rim light)
- The model should look natural, confident, and stylish
- Product details (color, shape, material, pattern, texture) must match the reference images EXACTLY

TECHNICAL:
- High-resolution commercial photography, 4K quality
- No text, watermark, or logo
- Photorealistic — must look like a real photograph, not AI-generated`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

    // 모든 상품 이미지를 참고 이미지로 포함 (최대 5장)
    const imageParts = [];
    if (productImages && Array.isArray(productImages)) {
      for (const imgData of productImages.slice(0, 5)) {
        if (!imgData || typeof imgData !== 'string') continue;
        const mimeMatch = imgData.match(/^data:(image\/\w+);base64,/);
        if (mimeMatch) {
          imageParts.push({
            inlineData: { mimeType: mimeMatch[1], data: imgData.split(',')[1] }
          });
        }
      }
    }

    const textPart = imageParts.length > 0
      ? `Here are ${imageParts.length} reference photo(s) of the product. Study the product's color, shape, material, and design carefully, then determine what type of product it actually is (regardless of the category label). Then create: ${prompt}`
      : prompt;

    const requestBody = {
      contents: [{ role: 'user', parts: [...imageParts, { text: textPart }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], maxOutputTokens: 4096 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini Image 에러:', data);
      return res.status(response.status).json({
        error: data.error?.message || `이미지 생성 실패 (${response.status})`
      });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart) {
      return res.status(500).json({
        error: 'AI가 이미지를 생성하지 못했습니다. 다시 시도해주세요.'
      });
    }

    monthlyCount.count++;

    return res.status(200).json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      remaining: 100 - monthlyCount.count,
      used: monthlyCount.count,
      limit: 100,
      focus: focus.part
    });

  } catch (err) {
    console.error('모델 이미지 생성 에러:', err);
    return res.status(500).json({ error: err.message });
  }
}
