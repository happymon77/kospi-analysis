"""4개 CSV를 단일 JSON(dashboard/assets/data.json)으로 통합."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT  = ROOT / "dashboard" / "assets"
OUT.mkdir(parents=True, exist_ok=True)


def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    return df


def main() -> None:
    jeungsi = load(DATA / "jeungsi_jageum_2026Q1Q2.csv")[["date", "투자자예탁금"]]
    credit  = load(DATA / "신용공여_잔고_2026Q1Q2.csv")[["date", "신용거래융자_전체"]]
    credit  = credit.rename(columns={"신용거래융자_전체": "신용잔고"})
    lending = load(DATA / "대차거래_추이_2026Q1Q2.csv")[["date", "잔고_금액"]]
    lending = lending.rename(columns={"잔고_금액": "대차잔고"})
    kospi   = load(DATA / "유가증권시장_2026Q1Q2.csv")[
        ["date", "KOSPI지수", "거래대금", "시가총액", "외국인_비중_pct"]
    ]

    df = kospi.merge(jeungsi, on="date", how="left") \
              .merge(credit,  on="date", how="left") \
              .merge(lending, on="date", how="left")
    df = df.sort_values("date").reset_index(drop=True)

    # 신용잔고/시총 비율 (%)
    df["신용_시총비율_pct"] = (df["신용잔고"] / df["시가총액"] * 100).round(3)

    out = {
        "range": {"start": df["date"].min(), "end": df["date"].max()},
        "rows": df.to_dict(orient="records"),
    }
    (OUT / "data.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[+] rows: {len(df)}  cols: {list(df.columns)}")
    print(f"[+] saved: {OUT / 'data.json'}")
    print(df.tail(3).to_string(index=False))


if __name__ == "__main__":
    main()
