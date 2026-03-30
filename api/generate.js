export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  try {
    // 프론트엔드에서 넘어온 페이로드 추출
    const { model, systemInstruction, contents, generationConfig } = req.body;
    
    // 프론트엔드에서 모델을 명시하지 않았을 경우의 기본값
    const targetModel = model || 'gemini-2.5-flash';
    
    // Gemini API 엔드포인트 URL 구성 (쿼리 파라미터로 API 키 전달)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Gemini 규격에 맞는 페이로드 재조립
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig
      })
    });

    const data = await response.json();
    
    // API 에러 처리
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    // 성공 응답 반환
    return res.status(200).json(data);
    
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}