PasuChat — まず公開する版
========================

このパッケージは、Supabaseで実際に成功確認できた「ログイン」と「タイムライン投稿」を優先した公開用の最小版です。
いいね・コメント・グループ招待など、未確認または不具合が残る機能は完成扱いにしないでください。

【GitHub Pagesへの公開】
1. ZIPを展開します。
2. GitHubで New repository を作成します（例: pasuchat）。Publicで作成。
3. リポジトリ画面の Add file → Upload files を選びます。
4. 展開したフォルダの中にある index.html / app.js / styles.css / config.js の4ファイルを、リポジトリ直下へアップロードします。
   ※ pasuchat-launch という親フォルダごとではなく、4ファイルそのものをアップロードしてください。
5. Commit changes を押します。
6. リポジトリの Settings → Pages を開きます。
7. Build and deployment で Deploy from a branch を選びます。
8. Branch を main、Folder を /(root) にして Save。
9. Pagesに表示された https://<GitHubユーザー名>.github.io/<リポジトリ名>/ を開きます。

【この版で確認済み】
- Supabase接続
- ユーザー名＋パスワードでログイン
- タイムラインへの投稿保存（ページ再読み込み後も残る）

【未完成・未検証】
- いいね・コメント
- グループ招待／承認
- すべてのフレンド機能・通知・公開範囲の権限制御
- 本番公開向けの迷惑登録対策・包括的なセキュリティテスト

注意:
- この公開用フォルダには Supabase Publishable key が入った config.js が含まれます。Publishable keyはブラウザで使う公開用キーです。
- Supabase Secret key / service_role key / Database Password は絶対に追加・公開しないでください。
- 今回失敗した fix-v07-social-group.sql は実行しないでください。元のデータベース設定を保持したまま、まずは公開を優先します。
- 公開後は、登録情報に個人情報や使い回しパスワードを使わないでください。
