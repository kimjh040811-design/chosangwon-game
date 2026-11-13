# 초상권을 지켜라!

마루가 친구들과 사진을 고르고 SNS에 공유하는 교육용 웹게임입니다. 롯데월드, 스티커 사진과 셀카, 우사기의 생일파티, 체육대회에서 사진 16장을 살펴봅니다.

친구의 의견을 듣고 사진을 편집하거나 보관할 수 있습니다. 친한 친구 공개와 전체 공개에 따라 친구의 조건이 달라집니다. 각 만남에서 고른 사진은 하나의 게시물로 올리고, 게시 후 요청은 사진을 실제로 내리는 행동과 연결됩니다. 상단의 크게 보기 버튼으로 게임과 채팅을 확대할 수 있습니다.

## GitHub Pages 배포

배포가 끝나면 컴퓨터에서 개발 서버를 켜지 않고 웹 주소로 접속합니다.

1. 이 게임을 담을 GitHub 저장소를 만듭니다.
2. 프로젝트 파일을 main 브랜치에 올립니다.
3. 저장소 Settings → Pages에서 Source → GitHub Actions를 선택합니다.
4. Actions → Deploy game to GitHub Pages 실행이 완료되면 배포 주소를 확인합니다.

이후 main 브랜치를 업데이트하면 게임 검사와 빌드를 거쳐 자동 배포됩니다. 수동 실행에는 같은 워크플로의 Run workflow를 사용합니다. 프로젝트 주소는 일반적으로 https://계정이름.github.io/저장소이름/ 형태입니다.

이미지 경로는 하위 주소에 대응하도록 설정했습니다. [Vite 공식 배포 안내](https://vite.dev/guide/static-deploy.html#github-pages)에서도 설정을 확인할 수 있습니다.

## 진행 기록

진행은 접속한 브라우저에 저장됩니다. 기기, 브라우저 또는 접속 주소가 바뀌면 별도의 진행 기록을 사용합니다.

## 로컬 실행

Node.js 24와 npm을 사용합니다.

```sh
npm ci
npm run dev
```

개발 주소는 http://localhost:5173/ 입니다.

```sh
npm test
npm run build
npm run preview
```

빌드 결과는 dist/ 에 생성되고 미리보기 주소는 http://localhost:4173/ 입니다. Chromium UI 검사는 npm run test:ui 로 실행합니다.

배포에는 빌드한 dist/ 를 사용합니다. 로컬 백업, QA 기록과 제작용 원본 자료는 Git 추적에서 제외했습니다.
