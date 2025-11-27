# みんなの絵画展（Railwayデプロイ版・Postgres永続）

- マルチユーザーで同時アクセスOK
- 作品・いいね履歴は **Postgres** に保存（永続）
- タブ順：**絵画展** / **いいね履歴・ランキング（管理）** / **絵画登録（管理）**
- 管理タブは **管理者パスワード必須**
- 入場時に名前を一度だけ入力（変更不可）。各作品につき1回だけ「いいね」可能（DBで UNIQUE(username, artwork_id) で強制）

## セットアップ（ローカル）
```bash
npm i
# .env は不要（Railwayで環境変数を設定）。ローカルは自前のPostgresを立て、DATABASE_URL を export してください。
export DATABASE_URL=postgres://user:pass@host:5432/dbname
export ADMIN_PASSWORD=your-admin-pass
export ADMIN_JWT_SECRET=change_me_secret
npm start
# http://localhost:3000
```

## Railway デプロイ手順
1. Railway で新規プロジェクト → 「**Deploy from GitHub**」または ZIP をリポジトリ化して接続
2. 「**Add Plugin**」→ **PostgreSQL** を追加（接続 URL が `DATABASE_URL`）
3. プロジェクトの **Variables** に以下を設定  
   - `DATABASE_URL`（Postgres の接続URL ※自動連携される場合あり）  
   - `ADMIN_PASSWORD`（管理者パスワード）  
   - `ADMIN_JWT_SECRET`（任意の長いランダム文字列）
4. デプロイ後にアクセス。ヘッダ右の「管理者ログイン」からパスワードでログイン → 管理タブが開けます。

## 備考
- 画像は DB（BYTEA）に保存します。数が非常に多い場合は S3 等に切替可能です。
- 「いいね」重複は DB のユニーク制約で防止。名前を変えても別ユーザー扱いです（仕様）。
- 画像の最大 15MB を許容（`server.js` の multer 設定で変更可）。

## 作品の編集/削除（管理）
- 管理ログイン後、登録一覧の各カードに **編集** / **削除** ボタンが表示されます。
- 編集では題名・作者の変更、画像の差し替え（任意）が可能です。
- 削除時はその作品のいいね履歴も一緒に削除されます（外部キーCASCADE）。


## 並び替え（ドラッグ＆ドロップ）
- 管理ログイン後、「絵画登録」一覧でカードを**ドラッグ＆ドロップ**して並び替え可能です。
- 並び替えは即座にサーバへ保存され、`sort_order` に反映されます。
- 展示やランキングの並びも `sort_order` 優先で表示されます。
