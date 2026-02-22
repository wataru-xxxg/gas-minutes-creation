# POST で Google ドキュメントを自動作成する GAS

POST リクエストを受けると、Google ドキュメントを自動作成する Google Apps Script（GAS）です。**TypeScript** で記述し、**clasp** でデプロイできます。

## 開発環境（TypeScript + clasp）

- Node.js / npm
- [clasp](https://github.com/google/clasp)（Google Apps Script 用 CLI）
- `@types/google-apps-script`（型定義）

```bash
npm install
npm run typecheck   # 型チェックのみ（ローカル）
```

## デプロイ手順

### 1. スクリプトを Google に配置

**方法 A: 手動でコピー（JavaScript のまま使う場合）**

1. [Google Apps Script](https://script.google.com/) を開く
2. 「新しいプロジェクト」でプロジェクトを作成
3. `src/Main.ts` をビルドした結果、または従来の `src/Main.gs` の内容を `Code.gs` に貼り付け
4. 保存（Ctrl+S / Cmd+S）

**方法 B: TypeScript + clasp でプッシュ（推奨）**

1. 初回のみ: clasp にログインし、プロジェクト作成

```bash
npx clasp login
npx clasp create --type standalone --title "Minutes Creation"
```

2. 作成された `.clasp.json` に `rootDir` を追加（ソースを `src/` に置いている場合）

```json
{
  "scriptId": "ここに表示されたID",
  "rootDir": "src"
}
```

3. プッシュ（TypeScript は clasp が自動でコンパイルしてアップロード）

```bash
npm run push
# または watch で変更を監視: npm run push:watch
```

- 既存の GAS プロジェクトに紐づける場合: `clasp clone <scriptId>` のあと、上記の `rootDir` を設定

### 2. ウェブアプリとしてデプロイ

1. エディタで「デプロイ」→「新しいデプロイ」
2. 種類で「ウェブアプリ」を選択
3. 説明を任意で入力（例: 「POST でドキュメント作成 v1」）
4. 「次のユーザーとして実行」: **自分**
5. 「アクセスできるユーザー」: **全員**（匿名 POST を受け取る場合）
6. 「デプロイ」をクリック
7. 表示された **ウェブアプリの URL** を控える

## 使い方

### POST でドキュメントを作成する

**Content-Type: application/json の場合**

**議事録形式（推奨）** — 英語キーの `agenda` / `nextActions` で送ると、「【議事内容】」「【次のアクション】」付きの議事録として整形されます。

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "議事録 2025-02-01",
    "agenda": [
      {
        "number": 1,
        "topic": "主要な議題",
        "remarks": ["主な発言1", "主な発言2"],
        "decisions": ["決定事項1"]
      },
      {
        "number": 2,
        "topic": "次の議題",
        "remarks": ["主な発言"],
        "decisions": ["決定事項"]
      }
    ],
    "nextActions": [
      {
        "task": "タスク内容",
        "assignee": "担当者名",
        "dueDate": "2025-02-10"
      }
    ]
  }'
```

**従来形式** — `paragraphs` で段落の配列をそのまま送ることもできます。

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "議事録 2025-02-01",
    "paragraphs": [
      "## 会議名: 定例ミーティング",
      "日時: 2025-02-01 10:00",
      "### 議題1",
      "決定事項: ...",
      "### 議題2",
      "決定事項: ..."
    ]
  }'
```

**パラメータ**

| キー          | 説明                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `title`       | ドキュメントのタイトル（省略時: 「新規ドキュメント」）                                                        |
| `agenda`      | 議事録形式用。議題の配列（各要素: `number`, `topic`, `remarks`, `decisions`）。指定時は議事録として整形される |
| `nextActions` | 議事録形式用。次のアクションの配列（各要素: `task`, `assignee`, `dueDate`）                                   |
| `content`     | 1 つの段落として追加するテキスト（`agenda` / `paragraphs` が無い場合）                                        |
| `paragraphs`  | 配列。各要素が 1 段落として追加される（`agenda` が無い場合に有効）                                            |

**成功時のレスポンス例**

```json
{
  "success": true,
  "documentId": "1abc...",
  "documentUrl": "https://docs.google.com/document/d/1abc.../edit",
  "documentName": "議事録 2025-02-01"
}
```

**エラー時**

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

### GET で確認

同じ URL に GET すると、POST のサンプルが返ります。

```bash
curl "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
```

## 注意事項

- 作成されたドキュメントは**スクリプトを実行した Google アカウント**のドライブに保存されます
- 「全員」でデプロイすると、URL を知っていれば誰でも POST できます。認証が必要な場合は「自分と同一組織」などに変更し、リクエスト側で OAuth 等を検討してください
- GAS の実行時間・クォータの制限に注意してください

## ファイル構成

```
minutes-creation/
├── src/
│   └── Main.ts      # doPost / doGet とドキュメント作成ロジック（TypeScript）
├── appsscript.json  # GAS マニフェスト
├── package.json     # npm スクリプト・型定義
├── tsconfig.json    # TypeScript 設定（型チェック・IDE用）
└── README.md
```

- **TypeScript のみ開発する場合**: `src/Main.ts` を編集し、`clasp push` でアップロード。`Main.gs` は不要（clasp が .ts をコンパイルして GAS に送るため）。
- **手動で GAS に貼る場合**: `Main.ts` をローカルでコンパイルするか、従来の `Main.gs`（JavaScript）を別途用意してコピーしてください。
