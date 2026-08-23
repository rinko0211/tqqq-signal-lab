# TQQQ Signal Lab

TQQQ / QQQ / SPY / VIXの日次実データを使い、Volatility Shieldの理論目標ポジションを毎営業日評価するPWAです。

- 判定: 米国営業日 `t` の終値後
- 約定仮定: `t+1` 営業日の始値
- 手数料: 3bps
- スリッページ: 5bps
- 配分: 0 / 25 / 50 / 75 / 100%
- データ取得失敗時: 新しいSignalを作らず、失敗状態を表示
- Paper Trading: 端末内保存。未来データ不使用

## 最初にすること

1. **Settings** → 左メニューの **Pages** を開きます。
2. **Source** で **GitHub Actions** を選びます。
3. リポジトリ上部の **Actions** を押します。
4. **Daily TQQQ Signal** を押します。
5. **Run workflow** → 緑色の **Run workflow** を押します。
6. 数分後、実行に緑のチェックが付くことを確認します。
7. Pages欄に表示されたURLをSafariで開きます。

サイト内の **初めて使う方へ** に、GitHubアカウント作成からiPhoneのホーム画面追加、Paper Trading開始までの15ステップがあります。

## 日次更新

`.github/workflows/daily-signal.yml` が平日に自動実行します。日本時間では原則として火曜〜土曜の朝です。米国休場日、未更新、取得失敗は別の状態として表示します。

```text
Nasdaq / Cboe
  → GitHub Actions
  → Signal Engine
  → signal.json / live-history.json
  → GitHub Pages
  → iPhone PWA
```

## テスト

```bash
npm ci
npm test
```

計算、翌営業日約定、Look-ahead防止、Walk-Forward分割、Paper Trading、二重約定防止、Split、休日、PWAキャッシュ、生成JSONを検査します。

## データ

- TQQQ / QQQ / SPY: Nasdaq Historical
- VIX: Cboe VIX History
- 配当再投資込みのTotal Returnではなく価格リターン
- 欠損や日付不整合は黙って補完しません

## 注意

研究・検証用途です。投資助言ではなく、将来の収益を保証しません。実売買前にLive Paper Tradingで継続評価してください。
