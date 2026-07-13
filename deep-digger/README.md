# Deep Digger

하나의 주제를 레벨 5까지 파고드는 영어 학습 앱. `Deep Digger`(청소년/성인용)와 `Deep Digger Kids`(어린이용, 게임 포함) 두 버전이 들어있다.

- `/` — 버전 선택 화면
- `/?app=main` — Deep Digger 바로 열기
- `/?app=kids` — Deep Digger Kids 바로 열기

## 구조

```
deep-digger/
├── api/
│   └── claude.js       # Anthropic API를 대신 호출하는 서버리스 함수 (키가 여기서만 사용됨)
└── src/
    ├── App.jsx          # 버전 선택 화면
    ├── DeepDigger.jsx
    ├── DeepDiggerKids.jsx
    └── lib/callClaude.js
```

브라우저는 `/api/claude`만 호출하고, 실제 Anthropic API 키는 서버(Vercel) 환경 변수에만 존재한다. 그래서 로그인 없이 링크만으로 열어도 API 키가 노출되지 않는다.

## 로컬 개발

```bash
npm install
npm run dev
```

`npm run dev`(Vite)만으로는 `api/claude.js`가 동작하지 않는다. API 호출까지 테스트하려면 [Vercel CLI](https://vercel.com/docs/cli)로 실행한다.

```bash
npm install -g vercel
vercel dev
```

## 배포 (Vercel)

1. 이 저장소를 GitHub에 push
2. [vercel.com](https://vercel.com) → Add New Project → 이 저장소 선택 (Root Directory를 `deep-digger`로 지정)
3. Environment Variables에 추가:
   - `ANTHROPIC_API_KEY` — [console.anthropic.com](https://console.anthropic.com)에서 발급한 키
4. Deploy

배포가 끝나면 나온 URL을 그대로 학생들에게 공유하면 된다.
