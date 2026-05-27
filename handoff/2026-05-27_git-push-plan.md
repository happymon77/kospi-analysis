# Handoff — KOSPI 분석 대시보드 Git 푸시 작업

- **작성일**: 2026-05-27 17:52 KST
- **작업 디렉토리**: `D:\claude_project\kospi_analysis2`
- **타깃 GitHub Repo**: https://github.com/happymon77/kospi-analysis (생성 완료, 빈 상태)
- **Git 로컬 ID**: happymon77 / happymon77@gmail.com (전역 설정 OK)

---

## 1. 현재 상태

### 폴더 구조
```
kospi_analysis2/
├── .gitignore
├── README.md
├── requirements.txt
├── .github/workflows/daily-update.yml
├── dashboard/
│   ├── app.js
│   ├── index.html
│   ├── style.css
│   └── assets/data.json
├── data/
│   ├── jeungsi_jageum_2026Q1Q2.csv     ← 파일명 규칙 불일치 (로마자)
│   ├── 대차거래_추이_2026Q1Q2.csv
│   ├── 신용공여_잔고_2026Q1Q2.csv
│   └── 유가증권시장_2026Q1Q2.csv
└── src/
    ├── build_dashboard_data.py
    ├── check_alerts.py
    └── collect_freesis.py
```

### Git 상태
- 로컬 폴더는 **아직 `git init` 안 됨**
- 원격 repo는 **빈 상태** (브랜치 없음, `git ls-remote` 결과 0 ref)
- `gh` CLI는 설치 안 되어 있음 → 순수 git만으로 진행 가능

### .gitignore 내용 (이미 작성됨)
```
.venv/
__pycache__/
*.pyc, *.pyo
data/probe/
dashboard-flat.zip
_preview*.png, _p_*.png, _kc*.png, _deploy_*.png
src/_*.py
.DS_Store, Thumbs.db
```

---

## 2. Git 푸시 계획 (확정된 절차)

### Step 1. 사전 점검
- 민감 정보 스캔: `.env`, 패스워드, API 키 등 평문 노출 없는지 확인
- SMTP는 `daily-update.yml`에서 `${{ secrets.* }}`로 처리 → 코드 노출 없음 ✓

### Step 2. Repo 초기화
```powershell
git init -b main
git remote add origin https://github.com/happymon77/kospi-analysis.git
```

### Step 3. 첫 커밋
```powershell
git add .
git status            # 스테이징 결과 검수
git commit -m "Initial commit: KOSPI money tracking dashboard"
```

### Step 4. 푸시
```powershell
git push -u origin main
```
- Windows: Git Credential Manager가 브라우저 인증 자동 처리 예상
- 실패 시 PAT(Personal Access Token) 발급 필요

---

## 3. 푸시 이후 사용자 직접 작업 (Claude 불가)

1. **GitHub Secrets 등록** — Repo Settings → Secrets and variables → Actions
   | 키 | 값 |
   |---|---|
   | `SMTP_HOST` | 회사 SMTP 서버 |
   | `SMTP_PORT` | 587 또는 465 |
   | `SMTP_USER` | 발신 이메일 |
   | `SMTP_PASS` | SMTP 비밀번호 |
   | `MAIL_TO`   | 수신자 (쉼표 구분) |
   | `MAIL_FROM` | (선택) 발신자 표시명 |

2. **Cloudflare Pages 연결**
   - Pages → Create project → GitHub repo 연동
   - Production branch: `main`
   - Build command: (없음)
   - Build output directory: `dashboard`

3. **Actions 첫 수동 실행**
   - Actions 탭 → `daily-update` → Run workflow (workflow_dispatch)
   - cron(KST 21:00) 전 동작 검증 목적

---

## 4. 리스크 / 주의사항

- `daily-update.yml`이 매일 `git push`로 `data/` + `dashboard/assets/data.json` 갱신
  → main 브랜치 보호 규칙 걸면 Actions가 실패. 기본은 미보호이니 OK
- 첫 커밋 크기: 약 84KB (data CSV 4개 + dashboard JSON 31KB) — 부담 없음
- `data/jeungsi_jageum_2026Q1Q2.csv` 파일명만 로마자 → 일관성 이슈 (기능엔 영향 없음)

---

## 5. 미해결 / 보류 항목

- **"불필요한 파일 정리" 요청** — 어떤 파일을 지우려 했는지 사용자 기억 미상. 현재 폴더는 이미 깨끗한 상태이므로 보류
- **금투협회 사이트 관련 질문** — 사용자가 입력 중 중단. 다음 세션에서 재확인 필요
- **data/ 파일명 통일 여부** — `jeungsi_jageum_*` → `투자자예탁금_*` 등으로 통일할지 미결정. 통일 시 `collect_freesis.py` / `build_dashboard_data.py` 동시 수정 필요

---

## 6. 다음 액션

사용자 승인 후 **Step 1 사전 점검 → Step 4 푸시**까지 자동 진행 가능.
또는 사전에 data/ 파일명 통일 작업을 먼저 처리할지 결정 필요.
