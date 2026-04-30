# ✦ PageCraft Pro

> **AI 상품 상세페이지 자동 생성기 — 패션·의류·잡화 특화**
> 상품 사진 + 정보를 입력하면 Gemini AI가 카피라이팅 + PNG 상세페이지 + SEO 상품명 + 쿠팡 태그 20개를 자동 생성합니다.

- **GitHub:** [luazencloud-design/pagecraft-pro](https://github.com/luazencloud-design/pagecraft-pro)
- **버전:** v2.1.0
- **기술 스택:** Vercel Serverless · Node.js 18+ · Gemini 2.5 Flash · @napi-rs/canvas
- **공개 배포:** 누구나 접근 가능 (사용량 제한 없음). 접근 제어가 필요하면 `pagecraft-sharable`을 사용하세요.

---

## 📋 목차

1. [프로젝트 개요](#-프로젝트-개요)
2. [파일 구성](#-파일-구성)
3. [코드 원리](#-코드-원리)
4. [다운로드 방법](#-다운로드-방법)
5. [외부 서비스 연동 (API 키)](#-외부-서비스-연동-api-키)
6. [Vercel 배포 6단계](#-vercel-배포-6단계)
7. [로컬 실행 방법](#-로컬-실행-방법)
8. [화면 구성 & 사용법](#-화면-구성--사용법)
9. [트러블슈팅](#-트러블슈팅)
10. [후임자 메모](#-후임자-메모)

---

## 🎯 프로젝트 개요

상품 사진을 업로드하면 AI가 다음을 자동 생성합니다:

| 결과물 | 설명 |
|--------|------|
| 📄 **상세페이지 PNG** | 800px 너비 · 헤더/메인카피/판매포인트/스펙/키워드/주의사항이 합쳐진 단일 이미지 |
| ✨ **상품명 5개** | SEO 최적화 (50자 이내, 5가지 전략별: 핵심키워드/속성/타깃/브랜드/롱테일) |
| 🏷 **쿠팡 태그 20개** | 쿠팡 자동완성을 반영한 검색 태그 (2~12자, 중복·과장 금지) |
| 📋 **항목별 텍스트** | 카피, 스펙, 키워드 등 쿠팡/스마트스토어에 그대로 붙여넣을 수 있도록 분리 |

**최근 추가 기능:**
- 🖼 클라이언트 사이드 배경 제거 (`@imgly/background-removal` ONNX 모델, CDN 로드)
- 📦 이미지 자동 압축 (800px·JPEG 80%) → Vercel 413 페이로드 초과 방지
- 🔁 JSON 파싱 5단계 fallback (토큰 잘림 대응)
- 🛒 쿠팡 자동완성 통합 (상품명·태그 생성에 실 검색어 반영)

---

## 📁 파일 구성

```
pagecraft-pro/
├── index.html           메인 웹앱 (UI + 프론트 JS, 약 1,539줄)
├── api/
│   ├── generate.js      Gemini API 프록시 (텍스트 생성)
│   └── render.js        @napi-rs/canvas 기반 PNG 렌더링 (~470줄)
├── package.json         의존성: @napi-rs/canvas
├── vercel.json          Vercel 배포 설정 (라우팅 + maxDuration)
├── setup-fonts.js       빌드 시 NotoSansKR 폰트 다운로드
├── fonts/               한글 폰트 (자동 생성, .gitignore 됨)
└── README.md            이 문서
```

### 각 파일의 책임

| 파일 | 책임 | 변경 빈도 |
|------|------|-----------|
| `index.html` | 3분할 UI(좌:입력 / 중:미리보기 / 우:결과탭) + 모든 클라이언트 로직 | 잦음 |
| `api/generate.js` | 환경변수 `GEMINI_API_KEY`로 Gemini API 호출. CORS 처리. | 거의 없음 |
| `api/render.js` | JSON 결과 + 이미지 → 800px PNG 생성. 폰트 3-tier fallback. | 디자인 변경 시 |
| `vercel.json` | `api/render.js` 60초·이미지 폰트 포함, `api/generate.js` 30초 | 거의 없음 |
| `setup-fonts.js` | `fonts/NotoSansKR-Regular.ttf` 자동 다운로드 (Vercel 빌드 단계) | 거의 없음 |

---

## 🧬 코드 원리

### A. 데이터 흐름 (End-to-End)

```
사용자 입력
├─ 이미지 (드래그/클릭)  → compressImage() → 800px JPEG 80%
│                       → (선택) removeBgFromDataUrl() ONNX
│                       → imgs[] 배열에 저장
├─ 텍스트 입력 (브랜드/상품명/가격/카테고리/특징/메모)
└─ [생성] 버튼 클릭
   │
   ├─ POST /api/generate
   │   body: { model: "gemini-2.5-flash", systemInstruction, contents:[이미지+텍스트] }
   │   → Gemini가 JSON 응답 (product_name, main_copy, selling_points, specs, keywords, caution)
   │
   ├─ 5단계 JSON 파싱 fallback (resultData)
   │
   ├─ POST /api/render
   │   body: { data: resultData, price, images: dataURL[] }
   │   → ensureFonts() (bundle → /tmp 캐시 → CDN)
   │   → 800px Canvas에 18개 섹션 그리기
   │   → PNG Buffer 반환
   │
   ├─ 우측 패널 4개 탭 활성화
   │   📄 텍스트  ✨ 상품명  🏷 태그  ⬇ 내보내기
   │
   └─ 추가 생성 (선택)
      ├─ runTitleGen() → fetchCoupangSuggest() + Gemini → 상품명 5개
      └─ runTagGen()   → fetchCoupangSuggest() + Gemini → 태그 20개
```

### B. `index.html` 핵심 함수 매핑

| 함수 | 줄 | 역할 |
|------|----|----|
| `compressImage(file, maxWidth)` | 699 | 이미지 800px 리사이즈 + JPEG 80% 압축 |
| `loadBgRemoveModel()` | 747 | `@imgly/background-removal` ONNX 비동기 로드 |
| `removeBgFromDataUrl()` | 780 | 배경 제거 실행 |
| `processAllBgRemoval()` | 800 | 업로드된 이미지에 일괄 적용 |
| `handleFiles(files)` | 849 | 파일 처리 + 압축 + (선택) 배경 제거 |
| `renderThumbs()` | 902 | 썸네일 그리드 갱신 |
| **`#genBtn.onclick`** | **958** | **메인 흐름: generate → render** |
| `runTitleGen()` | 1196 | 상품명 5개 생성 (쿠팡 자동완성 반영) |
| `runTagGen()` | 1376 | 태그 20개 생성 (쿠팡 자동완성 8개 이상 포함) |
| `fetchCoupangSuggest(seeds)` | 1184 | `/api/coupang-suggest` 호출 (현재 미구현 시 클라이언트 fallback) |
| `downloadImg()` | 1171 | 결과 PNG 다운로드 |

### C. `api/render.js` 레이아웃 (800px × 동적높이)

캔버스에 위에서 아래로 다음 섹션을 순서대로 그립니다:

```
1. 헤더 (다크 배경 + 노란색 카테고리 + 흰색 상품명)        110px
2. 메인 사진 (이미지 1)                                  800px
3. 메인 카피 (베이지 배경 + GOLD 라인)                   190px
4. 구분 이미지 (4, 8)                                    600px×2
5. 판매 포인트 3열 (베이지)                              270px
6. 구분 이미지 (5, 9)                                    600px×2
7. 상세 설명 1문단                                       180px
8. 구분 이미지 (6)                                       600px
9. 상세 설명 2문단                                       180px
10. 구분 이미지 (7, 10)                                  600px×2
11. 컬러 선택 (이미지 2+3)                               500px
12. 스펙 표 (베이지)                                     320px
13. 키워드 클라우드                                      120px
14. 주의사항 (글머리 •)                                  200px
15. 푸터 (가격/브랜드)                                    90px
```

**색 팔레트:**
```js
BG '#fff' / BLACK '#0f0f0f' / GRAY '#646464'
GOLD '#c8a050' / YELLOW '#ffc800' / SISAL '#E5E1D6'
```

**폰트 로드 (3-tier):**
1. 번들된 `fonts/NotoSansKR-Regular.ttf`
2. `/tmp/pagecraft-fonts/NotoSansKR.otf` (Vercel 콜드스타트 캐시)
3. jsdelivr CDN 다운로드 → `/tmp` 캐시 후 사용
4. 모두 실패 → `sans-serif` (한글 깨질 수 있음)

---

## 📥 다운로드 방법

### 옵션 A — Git Clone (권장)

```bash
git clone https://github.com/luazencloud-design/pagecraft-pro.git
cd pagecraft-pro
```

### 옵션 B — ZIP 다운로드

1. [GitHub repo](https://github.com/luazencloud-design/pagecraft-pro) 접속
2. **Code → Download ZIP** 클릭
3. 압축 해제

---

## 🔑 외부 서비스 연동 (API 키)

### Gemini API Key 발급

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 접속
2. **Create API Key** 클릭
3. `AIza...`로 시작하는 키 복사 (한 번만 표시되니 안전한 곳에 저장)

> 💰 **요금:** Gemini 2.5 Flash 기준 상세페이지 1개 생성당 약 $0.001~0.005 (이미지 포함). 무료 할당량(분당 15회/일 1500회) 이내라면 비용 0원.

### Vercel 환경변수 설정

배포 후 Vercel 대시보드에서:

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | `AIza...` (위에서 발급받은 키) |

> ⚠️ 환경변수 설정 후 반드시 **Redeploy** 해야 적용됩니다.

---

## 🚀 Vercel 배포 6단계

### STEP 1 — GitHub 계정 준비

[github.com](https://github.com)에서 가입 + 이메일 인증 완료.

### STEP 2 — 저장소 만들기

1. 우측 상단 `+` → **New repository**
2. Repository name: `pagecraft-pro` (Public 권장)

### STEP 3 — 파일 업로드

`pagecraft-pro/` 폴더의 모든 파일을 GitHub에 업로드:
- `index.html`, `vercel.json`, `package.json`, `setup-fonts.js`, `README.md`
- `api/generate.js`, `api/render.js` (반드시 `api` 폴더 안에)

### STEP 4 — Vercel 연결

1. [vercel.com](https://vercel.com) → **GitHub으로 로그인**
2. **New Project** → `pagecraft-pro` 저장소 → **Import**
3. 설정 변경 없이 **Deploy**

### STEP 5 — API 키 설정 ⭐

1. Vercel 대시보드 → 방금 만든 프로젝트 클릭
2. **Settings → Environment Variables**
3. 위의 `GEMINI_API_KEY` 추가 → **Save**
4. **Deployments** 탭 → 최신 배포 옆 `⋯` → **Redeploy**

### STEP 6 — 링크 공유

배포 완료 후 `https://pagecraft-pro-xxxx.vercel.app` 링크를 사용자/수강생에게 공유.

---

## 🖥 로컬 실행 방법

```bash
npm install
npx vercel dev   # 또는 그냥 index.html을 브라우저로 열기 (API 호출은 안 됨)
```

> 로컬에서 API를 테스트하려면 `vercel dev`를 사용하고 `.env.local`에 `GEMINI_API_KEY=...`를 추가해야 합니다.

---

## 🖼 화면 구성 & 사용법

### 3분할 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  ✦ PageCraft Pro                       패션·의류·잡화    │
├──────────────┬──────────────────────────┬─────────────┤
│ 📷 이미지 업로드│   🖼 미리보기 캔버스       │ 📋 결과 탭   │
│ 브랜드/상품명  │                           │ • 텍스트     │
│ 가격/카테고리  │   생성된 PNG가             │ • 상품명     │
│ 특징 칩       │   여기 표시됩니다          │ • 태그       │
│ 메모          │                           │ • 내보내기   │
│ [생성 ▶]      │                           │              │
└──────────────┴──────────────────────────┴─────────────┘
```

### 사용 순서

1. 사진 업로드 (최대 10장, 드래그/클릭)
2. (선택) `🪄 배경 제거` 토글 ON
3. 브랜드, 상품명, 가격, 카테고리, 플랫폼 입력
4. 강조 특징 칩 클릭 (방수, 경량, 남녀공용 등)
5. **[AI 상세페이지 생성]** 버튼 클릭
6. 우측 탭에서 결과 확인:
   - **📄 텍스트** — 항목별 복사 버튼
   - **✨ 상품명** — 5개 SEO 최적화 (`상품명 생성` 버튼 추가 클릭 필요)
   - **🏷 태그** — 쿠팡 태그 20개 (`태그 생성` 버튼 추가 클릭 필요)
   - **⬇ 내보내기** — PNG 다운로드 / 전체 텍스트 복사

---

## 🛠 트러블슈팅

| 증상 | 원인 / 해결 |
|------|-------------|
| `❌ API 키가 설정되지 않았습니다` | Vercel `GEMINI_API_KEY` 미설정. STEP 5 + Redeploy. |
| `413 페이로드 초과` | 이미지가 너무 큼. 압축 로직(`compressImage`)이 작동하는지 콘솔 확인. |
| 한글이 □ 로 깨짐 | `setup-fonts.js`가 빌드에서 실행되지 않음. Vercel `buildCommand` 확인. |
| JSON 파싱 실패 | Gemini 응답이 잘림. `maxOutputTokens` 올리거나 5단계 fallback이 동작하는지 확인. |
| 배경 제거 모델 로드 실패 | CDN 차단. `@imgly/background-removal@1.5.5` 버전 호환 확인. |

---

## 📝 후임자 메모

### 쉽게 변경할 수 있는 곳

| 변경 항목 | 위치 |
|----------|------|
| 상세페이지 색상 팔레트 | `api/render.js` 줄 89~99 (`BG`, `GOLD`, `YELLOW`, `SISAL`) |
| 섹션별 높이 | `api/render.js` 줄 105~113 (`heroH`, `copyH`, ...) |
| AI 카피 스타일/규칙 | `index.html` 줄 990~1000 (시스템 프롬프트) |
| 상품명 SEO 규칙 | `index.html` 줄 1255~1275 (제목 생성 프롬프트) |
| 태그 생성 규칙 | `index.html` 줄 1414~1437 (태그 생성 프롬프트) |
| Gemini 모델 | 줄 1006, 1281, 1443 의 `'gemini-2.5-flash'` |
| 폰트 추가 | `setup-fonts.js`의 `fonts` 배열에 항목 추가 |

### Vercel 제약 (반드시 인지)

- **Hobby 플랜:** 함수 최대 10초 → `api/render.js` 60초 한도가 깨짐. **Pro 플랜($20/월) 필수**.
- **함수 페이로드:** 최대 6MB → 이미지 자동 압축이 핵심.
- **배포 패키지:** 250MB → 폰트 1개만 사용 (다국어 추가 시 주의).

### 코드 품질 포인트

- 모든 클라이언트 로직이 `index.html` 한 파일에 있음 (의도적 단순화)
- 백엔드는 단 2개 함수 (`generate`, `render`)
- 프롬프트는 파일 내 주석으로 모두 가독성 있게 정리됨

### 관련 프로젝트

| 프로젝트 | 차이점 |
|----------|--------|
| `pagecraft-sharable` | 동일 코어 + 어드민 링크 시스템(접근 제어/IP 등록/세션 폴링/AI 모델 이미지 생성/월 100장 한도) |

---

*PageCraft Pro v2.1.0 — Powered by Gemini 2.5 Flash · Deployed on Vercel*
