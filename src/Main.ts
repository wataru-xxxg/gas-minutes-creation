/**
 * POSTリクエストでGoogleドキュメントを自動作成するWebアプリ（TypeScript）
 *
 * デプロイ: clasp push 後にスクリプトエディタで「デプロイ」→「ウェブアプリ」
 * 実行: 「全員」でアクセスを許可し、POSTでURLに送信
 */

/** 議題1件の型（英語キー） */
interface AgendaItem {
  number: number;
  topic: string;
  remarks: string[];
  decisions: string[];
}

/** 次のアクション1件の型（英語キー） */
interface NextAction {
  task: string;
  assignee: string;
  dueDate: string;
}

/** 議事録JSONの型（英語キー） */
interface Minutes {
  agenda: AgendaItem[];
  nextActions: NextAction[];
}

/** POSTで受け取るドキュメント作成用パラメータ */
interface DocumentParams {
  title: string;
  content: string;
  paragraphs: string[];
}

/** 成功時のAPIレスポンス */
interface CreateDocumentSuccess {
  success: true;
  documentId: string;
  documentUrl: string;
  documentName: string;
}

/** 失敗時のAPIレスポンス */
interface CreateDocumentError {
  success: false;
  error: string;
}

/** JSON body の型（受信時） */
interface PostBody {
  title?: string;
  content?: string;
  paragraphs?: string[];
  agenda?: AgendaItem[];
  nextActions?: NextAction[];
}

const DEFAULT_TITLE = '新規ドキュメント';
const DEFAULT_PARAMS: DocumentParams = {
  title: DEFAULT_TITLE,
  content: '',
  paragraphs: [],
};

/**
 * 議事録JSON（英語キー）をドキュメント用の段落配列に変換する
 */
function minutesToParagraphs(minutes: Minutes): string[] {
  const lines: string[] = [];

  lines.push('【議事内容】');
  for (const item of minutes.agenda ?? []) {
    lines.push(`${item.number}. ${item.topic}`);
    for (const r of item.remarks ?? []) {
      if (r != null && r !== '') lines.push('- ' + r);
    }
    for (const d of item.decisions ?? []) {
      if (d != null && d !== '') lines.push('- ' + d);
    }
    lines.push('');
  }

  lines.push('【次のアクション】');
  for (const action of minutes.nextActions ?? []) {
    const parts: string[] = [];
    if (action.task != null && action.task !== '') parts.push(`タスク: ${action.task}`);
    if (action.assignee != null && action.assignee !== '') parts.push(`担当者: ${action.assignee}`);
    if (action.dueDate != null && action.dueDate !== '') parts.push(`期限: ${action.dueDate}`);
    if (parts.length > 0) lines.push('- ' + parts.join(' / '));
  }

  return lines.filter((s) => s !== undefined);
}

/**
 * POSTリクエストを受け取り、Googleドキュメントを作成する
 */
function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const params = parsePostData(e);
    const doc = createDocument(params);
    const result: CreateDocumentSuccess = {
      success: true,
      documentId: doc.getId(),
      documentUrl: doc.getUrl(),
      documentName: doc.getName(),
    };
    output.setContent(JSON.stringify(result));
  } catch (err) {
    const result: CreateDocumentError = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
    output.setContent(JSON.stringify(result));
  }

  return output;
}

/**
 * POSTデータをパースする（JSON body または フォームパラメータ）
 */
function parsePostData(e: GoogleAppsScript.Events.DoPost | null): DocumentParams {
  const params: DocumentParams = { ...DEFAULT_PARAMS };

  if (!e?.postData) {
    return params;
  }

  const raw = e.postData.contents;
  const type = (e.postData.type ?? '').toLowerCase();

  if (type.includes('application/json') && raw) {
    try {
      const data = JSON.parse(raw) as PostBody;
      params.title = data.title ?? params.title;
      params.content = data.content != null ? String(data.content) : params.content;

      if (Array.isArray(data.agenda)) {
        const minutes: Minutes = {
          agenda: data.agenda,
          nextActions: Array.isArray(data.nextActions) ? data.nextActions : [],
        };
        params.paragraphs = minutesToParagraphs(minutes);
      } else if (Array.isArray(data.paragraphs)) {
        params.paragraphs = data.paragraphs;
      } else {
        params.paragraphs = params.content ? [params.content] : [];
      }
    } catch {
      params.content = raw;
      params.paragraphs = [raw];
    }
  } else if (e.parameter) {
    params.title = (e.parameter.title as string) ?? params.title;
    params.content = (e.parameter.content as string) ?? params.content;
    if (e.parameter.paragraphs) {
      try {
        const parsed = JSON.parse(e.parameter.paragraphs as string);
        params.paragraphs = Array.isArray(parsed) ? parsed : [params.content || ''];
      } catch {
        params.paragraphs = params.content ? [params.content] : [];
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
 */
function createDocument(params: DocumentParams): GoogleAppsScript.Document.Document {
  const title = params.title || DEFAULT_TITLE;
  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  if (params.paragraphs?.length > 0) {
    for (const text of params.paragraphs) {
      if (text != null && text !== '') {
        body.appendParagraph(String(text));
      }
    }
  } else if (params.content) {
    body.appendParagraph(params.content);
  } else {
    body.appendParagraph('このドキュメントはPOSTリクエストにより自動作成されました。');
    body.appendParagraph('作成日時: ' + new Date().toLocaleString('ja-JP'));
  }

  doc.saveAndClose();
  return doc;
}

/**
 * GETで動作確認用（オプション）
 */
function doGet(_e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(
    JSON.stringify({
      message: 'POSTでドキュメントを作成してください。',
      example: {
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({
          title: '議事録',
          agenda: [
            {
              number: 1,
              topic: '主要な議題',
              remarks: ['主な発言1', '主な発言2'],
              decisions: ['決定事項1'],
            },
            {
              number: 2,
              topic: '次の議題',
              remarks: ['主な発言'],
              decisions: ['決定事項'],
            },
          ],
          nextActions: [
            { task: 'タスク内容', assignee: '担当者名', dueDate: '2025-02-10' },
          ],
        }),
      },
    })
  );
  return output;
}
