Pasutantan — 元のPasuChat画面・機能を保った復元版

このZIPは、最後に正常動作を確認したPasuChat v0.8の4ファイルから作成しています。

- index.html: title / description / 起動中テキストだけPasutantanへ変更
- app.js: 画面上のブランド表記だけPasutantanへ変更。処理・DB名・認証用メール別名・RPC名は維持
- styles.css: 元ファイルから変更なし
- config.js: 元ファイルから変更なし（Supabase接続設定を保持）

GitHubへ反映する場合: ZIPを展開し、4つの実行ファイル(index.html, app.js, styles.css, config.js)をすべてリポジトリ直下へアップロードし、同名ファイルを置き換えてCommitしてください。READMEは公開ルートへ置く必要はありません。

このZIPはbranding.jsを使いません。index.html単独で別フォルダへ置かず、4ファイルを同じフォルダ／同じリポジトリ階層に置いてください。
