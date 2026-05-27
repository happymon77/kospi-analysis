# KOSPI 시장 자금 분석 대시보드

금융투자협회 FreeSIS 데이터로 KOSPI 시장의 자금 흐름(예탁금·거래대금·신용잔고·대차잔고)을 매일 자동 수집·시각화하는 정적 대시보드.

- **Live**: https://kospi-money-tracking.pages.dev/
- **데이터 갱신**: 매일 KST 21:00 (GitHub Actions cron)
- **이메일 알림**: 전일 대비 5개 조건 중 하나 트리거 시에만 발송

## 구조

```
kospi_analysis2/
├── src/
│   ├── collect_freesis.py        FreeSIS에서 4개 통계 CSV 수집
│   ├── build_dashboard_data.py   CSV 4개 → dashboard/assets/data.json 통합
│   └── check_alerts.py           전일 대비 알림 조건 평가
├── data/                         일별 CSV (git 추적)
├── dashboard/                    정적 사이트 (Cloudflare Pages 빌드 출력)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── assets/data.json
├── .github/workflows/
│   └── daily-update.yml          cron + email workflow
├── requirements.txt
└── .gitignore
```

## 로컬 실행

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python src/collect_freesis.py       # FreeSIS에서 CSV 갱신
python src/build_dashboard_data.py  # data.json 빌드
python -m http.server 8000 --directory dashboard
# http://localhost:8000 접속
```

## 이메일 알림 조건 (전일 대비, OR)

| 지표 | 조건 |
|---|---|
| KOSPI 지수 | −10% 이상 하락 |
| 투자자예탁금 | −10% 이상 감소 |
| 거래대금 | −10% 이상 감소 |
| 신용잔고 | +10% 이상 증가 |
| 대차잔고 | +10% 이상 증가 |

임계값 조정: `src/check_alerts.py` 의 `RULES` 상수.

## GitHub Secrets (Actions 동작용)

| 키 | 값 |
|---|---|
| `SMTP_HOST` | 회사 SMTP 서버 |
| `SMTP_PORT` | 587 또는 465 |
| `SMTP_USER` | 발신 이메일 |
| `SMTP_PASS` | SMTP 비밀번호 |
| `MAIL_TO`   | 수신자(들), 쉼표 구분 |
| `MAIL_FROM` | (선택) 발신자 표시명 |

## Cloudflare Pages 연동

- Source: GitHub repo
- Production branch: `main`
- Build command: (없음)
- Build output directory: `dashboard`

## 데이터 출처

금융투자협회 FreeSIS (https://freesis.kofia.or.kr) — 비공식 AJAX endpoint 사용.
