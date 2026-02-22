/**
 * POSTリクエストでGoogleドキュメントを自動作成するWebアプリ
 *
 * デプロイ: スクリプトエディタで「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
 * 実行: 「全員」でアクセスを許可し、POSTでURLに送信
 */

/**
 * POSTリクエストを受け取り、Googleドキュメントを作成する
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストオブジェクト
 * @returns {GoogleAppsScript.HTML.HtmlOutput} JSONレスポンス
 */
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const params = parsePostData(e);
    const doc = createDocument(params);
    const result = {
      success: true,
      documentId: doc.getId(),
      documentUrl: doc.getUrl(),
      documentName: doc.getName(),
    };
    output.setContent(JSON.stringify(result));
  } catch (err) {
    const result = {
      success: false,
      error: err.message || String(err),
    };
    output.setContent(JSON.stringify(result));
  }

  return output;
}

/**
 * 議事録JSON（英語キー: agenda, nextActions）をドキュメント用の段落配列に変換する
 * @param {Object} minutes - { agenda: Array<{number, topic, remarks, decisions}>, nextActions: Array<{task, assignee, dueDate}> }
 * @returns {string[]}
 */
function minutesToParagraphs(minutes) {
  const lines = [];

  lines.push("【議事内容】");
  (minutes.agenda || []).forEach(function (item) {
    lines.push(item.number + ". " + (item.topic || ""));
    (item.remarks || []).forEach(function (r) {
      if (r != null && r !== "") lines.push("- " + r);
    });
    (item.decisions || []).forEach(function (d) {
      if (d != null && d !== "") lines.push("- " + d);
    });
    lines.push("");
  });

  lines.push("【次のアクション】");
  (minutes.nextActions || []).forEach(function (action) {
    const parts = [];
    if (action.task != null && action.task !== "")
      parts.push("タスク: " + action.task);
    if (action.assignee != null && action.assignee !== "")
      parts.push("担当者: " + action.assignee);
    if (action.dueDate != null && action.dueDate !== "")
      parts.push("期限: " + action.dueDate);
    if (parts.length > 0) lines.push("- " + parts.join(" / "));
  });

  return lines;
}

/**
 * POSTデータをパースする（JSON body または フォームパラメータ）
 * 議事録形式（agenda, nextActions）または従来形式（paragraphs）に対応
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {Object} { title, content, paragraphs }
 */
function parsePostData(e) {
  let params = {
    title: "新規ドキュメント",
    content: "",
    paragraphs: [],
  };

  if (!e || !e.postData) {
    return params;
  }

  const raw = e.postData.contents;
  const type = (e.postData.type || "").toLowerCase();

  if (type.indexOf("application/json") !== -1 && raw) {
    try {
      const data = JSON.parse(raw);
      params.title = data.title || params.title;
      params.content =
        data.content != null ? String(data.content) : params.content;

      if (Array.isArray(data.agenda)) {
        const minutes = {
          agenda: data.agenda,
          nextActions: Array.isArray(data.nextActions) ? data.nextActions : [],
        };
        params.paragraphs = minutesToParagraphs(minutes);
      } else if (Array.isArray(data.paragraphs)) {
        params.paragraphs = data.paragraphs;
      } else {
        params.paragraphs = params.content ? [params.content] : [];
      }
    } catch (err) {
      params.content = raw;
      params.paragraphs = [raw];
    }
  } else if (e.parameter) {
    params.title = e.parameter.title || params.title;
    params.content = e.parameter.content || params.content;
    if (e.parameter.paragraphs) {
      try {
        params.paragraphs = JSON.parse(e.parameter.paragraphs);
      } catch (_) {
        params.paragraphs = [params.content || ""];
      }
    } else {
      params.paragraphs = params.content ? [params.content] : [];
    }
  } else if (raw) {
    params.content = raw;
    params.paragraphs = [raw];
  }

  return params;
}

/**
 * パラメータに基づいてGoogleドキュメントを作成する
 * @param {Object} params - { title, content, paragraphs }
 * @returns {GoogleAppsScript.Document.Document}
 */
function createDocument(params) {
  const title = params.title || "新規ドキュメント";
  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  if (params.paragraphs && params.paragraphs.length > 0) {
    params.paragraphs.forEach(function (text) {
      if (text != null && text !== "") {
        body.appendParagraph(String(text));
      }
    });
  } else if (params.content) {
    body.appendParagraph(params.content);
  } else {
    body.appendParagraph(
      "このドキュメントはPOSTリクエストにより自動作成されました。"
    );
    body.appendParagraph("作成日時: " + new Date().toLocaleString("ja-JP"));
  }

  doc.saveAndClose();
  return doc;
}

/**
 * GETで動作確認用（オプション）
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(
    JSON.stringify({
      message: "POSTでドキュメントを作成してください。",
      example: {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          title: "議事録",
          agenda: [
            {
              number: 1,
              topic: "主要な議題",
              remarks: ["主な発言1", "主な発言2"],
              decisions: ["決定事項1"],
            },
            {
              number: 2,
              topic: "次の議題",
              remarks: ["主な発言"],
              decisions: ["決定事項"],
            },
          ],
          nextActions: [
            { task: "タスク内容", assignee: "担当者名", dueDate: "2025-02-10" },
          ],
        }),
      },
    })
  );
  return output;
}
