var express = require('express');
const { zerox } = require("zerox");
const marked = require('marked');
var router = express.Router();

marked.setOptions({
  breaks: true, // 改行を<br>に変換
  gfm: true, // GitHub Flavored Markdownを有効化
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/', express.raw({type: '*/*', limit: '10mb'}), function(req, res, next) {
  // リクエストボディにバイナリデータが含まれているか確認
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'ファイルデータが含まれていません' });
  }

  // ファイルの拡張子を確認
  const fileExtension = req.get('Content-Type').split('/')[1];
  if (!['pdf', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(fileExtension)) {
    return res.status(400).json({ error: 'サポートされていないファイル形式です。PDF、Excel、Wordファイルのみ処理可能です。' });
  }

  // 一時ファイルを作成してバイナリデータを書き込む
  const tempFilePath = `/tmp/uploaded_file.${fileExtension}`;
  require('fs').writeFileSync(tempFilePath, req.body);

  zerox({
    filePath: tempFilePath,
    openaiAPIKey: process.env.OPENAI_API_KEY,
    maintainFormat: false,
    custom_system_prompt: `This document is written in vertical format. Please consider the vertical layout when recognizing and processing characters.
<japanese_text>
{{JAPANESE_TEXT}}
</japanese_text>
Pay particular attention to line breaks and column layouts specific to Japanese vertical writing. Accurately grasp the orientation and order of characters, and be careful not to change the meaning when converting to horizontal text.
If there are multiple columns or column layouts, read from the leftmost column in order, maintaining the top-to-bottom flow of each column. Reflect line breaks and paragraph divisions appropriately.
Accurately recognize and convert all characters and symbols, including kanji, hiragana, katakana, punctuation marks, and brackets. Pay attention to symbols specific to vertical writing and strings written in tate-chu-yoko (vertical-in-horizontal text).
Output the processed text as normal horizontal Japanese text. Ensure that the original document's meaning and context are fully preserved. Enclose the output in <converted_text> tags.
Following these instructions, please accurately process the provided vertical Japanese text and convert it to horizontal text.`,
  }).then(result => {
    // 結果を整形して返す
    const results = {
      pageCount: result.pages.length,
      contents: result.pages.map(page => ({
        pageNum: page.page,
        content: page.content
      }))
    };
    console.log(result)
    res.json(results);

    // 一時ファイルを削除
    require('fs').unlinkSync(tempFilePath);
  }).catch(error => {
    console.error('エラーが発生しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });

    // エラー時も一時ファイルを削除
    if (require('fs').existsSync(tempFilePath)) {
      require('fs').unlinkSync(tempFilePath);
    }
  });
});

module.exports = router;
